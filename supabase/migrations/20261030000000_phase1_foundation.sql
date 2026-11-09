-- ==============================================================================
-- MIGRATION: 20261030000000_phase1_foundation.sql
-- PRODUCT: CreatorOS AI (Phase 1 Database Foundation — Final Security Audit Hardened)
-- ARCHITECTURE: Modular Monolith, Strict Multi-Tenant Isolation, Least Privilege RBAC
-- ==============================================================================
-- SECURITY, CONCURRENCY & LIFECYCLE ARCHITECTURE:
-- 1. Single-Use, Transaction-Bound Internal Token Registry (Zero Custom GUCs):
--    - Zero custom GUC flags (`creatoros.*`) and zero reliance on `CURRENT_USER`
--      (which reflects the function owner inside `SECURITY DEFINER`).
--    - Private schema `creatoros_internal` is owned by `postgres` with all privileges
--      revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
--    - Every `public.workspace_members` mutation (except verified parent workspace
--      or `auth.users` FK cascade deletions) requires a single-use token in
--      `creatoros_internal.trusted_operations` bound to:
--        (txid [xid8], op_type, expected_tg_op, workspace_id, actor_user_id,
--         target_user_id, expected_old_role, expected_new_role)
--      and is atomically consumed via `DELETE ... RETURNING` inside the `BEFORE ROW`
--      trigger `public.enforce_workspace_member_safety()`, followed by independent
--      trigger-side verification of `auth.uid()`, RBAC rules, and owner invariants.
-- 2. RPC-Only Membership Mutations & Canonical 4-Level Lock Hierarchy:
--    - Direct `INSERT`, `UPDATE`, and `DELETE` privileges on `public.workspace_members`
--      are revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role` to
--      eliminate PostgreSQL executor scan-order row-lock inversions during multi-row DML.
--    - All mutations obey one strict partial lock order:
--        Level 0: `auth.users (id ASC)`
--        Level 1: `creatoros_internal.lock_workspace_boundary(ws_id)`
--                 (`public.workspaces FOR UPDATE` + `creatoros_internal.workspace_locks`
--                  version increment, acquired in `ws_id ASC` order when multi-workspace)
--        Level 2: `public.workspace_members (id ASC FOR UPDATE)`
--        Level 3: `public.workspace_settings (workspace_id)`
--    - Upserting `creatoros_internal.workspace_locks` enforces write-write conflict
--      serialization (`SQLSTATE 40001`) under `REPEATABLE READ` and `SERIALIZABLE`
--      in addition to strict row-lock serialization under `READ COMMITTED`.
-- 3. Personal Workspace Invariant & Atomic Collision-Safe Provisioning:
--    - Every user in `auth.users` is required to own (`role = 'owner'`) at least
--      one workspace; non-owner memberships in other workspaces never suppress
--      creation of a user's personal workspace.
--    - `profiles`, `workspaces`, `workspace_members (role = 'owner')`, and
--      `workspace_settings` are asserted post-provisioning or rolled back atomically.
--    - Workspace slug conflicts are recovered at `INSERT` time using full 128-bit
--      UUID entropy without `ON CONFLICT (slug) DO NOTHING`.
-- 4. Safe Account Deletion Lifecycle:
--    - `public.workspaces.created_by` uses `ON DELETE SET NULL` while enforcing
--      `NOT NULL` on `INSERT` and immutability on `UPDATE` (permitting `NULL`
--      exclusively when the referenced `auth.users` row no longer exists).
--    - `BEFORE DELETE ON auth.users` blocks deletion if the user is the sole
--      remaining owner of a shared multi-member workspace, cleans up sole-member
--      personal workspaces, and preserves shared workspaces whose ownership was
--      transferred.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS & LOCKED-DOWN INTERNAL SECURITY SCHEMA
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS creatoros_internal;
ALTER SCHEMA creatoros_internal OWNER TO postgres;
REVOKE ALL ON SCHEMA creatoros_internal FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1. TABLE: profiles
-- Extends Supabase auth.users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    preferred_language VARCHAR(10) DEFAULT 'id' NOT NULL,
    theme_preference VARCHAR(10) DEFAULT 'system' NOT NULL,
    onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL
);

ALTER TABLE public.profiles OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 2. TABLE: workspaces
-- Core multi-tenant boundary (`created_by` enforced NOT NULL on INSERT, ON DELETE SET NULL
-- only when original creator's auth.users account is deleted after ownership transfer)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    creator_mode VARCHAR(30) DEFAULT 'creator' NOT NULL,
    logo_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.workspaces OWNER TO postgres;

-- Idempotent migration of `workspaces.created_by` if table existed with NOT NULL / ON DELETE RESTRICT
DO $$
DECLARE
    v_con RECORD;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_attribute a
        WHERE a.attrelid = 'public.workspaces'::pg_catalog.regclass
          AND a.attname = 'created_by'
          AND a.attnotnull = TRUE
    ) THEN
        ALTER TABLE public.workspaces ALTER COLUMN created_by DROP NOT NULL;
    END IF;

    FOR v_con IN
        SELECT c.conname, c.confdeltype
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.workspaces'::pg_catalog.regclass
          AND c.contype = 'f'
          AND a.attname = 'created_by'
    LOOP
        IF v_con.confdeltype <> 'n' THEN
            EXECUTE pg_catalog.format('ALTER TABLE public.workspaces DROP CONSTRAINT %I', v_con.conname);
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'public.workspaces'::pg_catalog.regclass
          AND c.contype = 'f'
          AND a.attname = 'created_by'
          AND c.confdeltype = 'n'
    ) THEN
        ALTER TABLE public.workspaces
            ADD CONSTRAINT workspaces_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. TABLE: workspace_members
-- Multi-tenant RBAC (mutations restricted strictly to validated RPCs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 4. TABLE: workspace_settings
-- Workspace-specific preferences and configuration
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_settings (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    default_language VARCHAR(10) DEFAULT 'id' NOT NULL,
    default_ai_model VARCHAR(50) DEFAULT 'gemini-1.5-flash' NOT NULL,
    enable_auto_hashtag BOOLEAN DEFAULT TRUE NOT NULL,
    notify_on_publish BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL
);

ALTER TABLE public.workspace_settings OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 5. INTERNAL SECURITY & CONCURRENCY TABLES (creatoros_internal)
-- Strictly inaccessible to PUBLIC, anon, authenticated, and service_role.
-- ------------------------------------------------------------------------------

-- 5A. Single-use, transaction-scoped internal authorization token table
CREATE TABLE IF NOT EXISTS creatoros_internal.trusted_operations (
    id BIGSERIAL PRIMARY KEY,
    txid xid8 NOT NULL DEFAULT pg_catalog.pg_current_xact_id(),
    op_type VARCHAR(40) NOT NULL,
    expected_tg_op VARCHAR(10) NOT NULL,
    workspace_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,
    target_user_id UUID NOT NULL,
    expected_old_role VARCHAR(20),
    expected_new_role VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE creatoros_internal.trusted_operations
    ADD COLUMN IF NOT EXISTS expected_tg_op VARCHAR(10),
    ADD COLUMN IF NOT EXISTS expected_old_role VARCHAR(20),
    ADD COLUMN IF NOT EXISTS expected_new_role VARCHAR(20);

DO $$ BEGIN
    DELETE FROM creatoros_internal.trusted_operations;
END $$;

ALTER TABLE creatoros_internal.trusted_operations
    ALTER COLUMN op_type TYPE VARCHAR(40),
    ALTER COLUMN expected_tg_op SET NOT NULL;

ALTER TABLE creatoros_internal.trusted_operations
    DROP CONSTRAINT IF EXISTS trusted_operations_op_type_check,
    DROP CONSTRAINT IF EXISTS check_trusted_operations_op_type,
    DROP CONSTRAINT IF EXISTS check_trusted_operations_tg_op;

ALTER TABLE creatoros_internal.trusted_operations
    ADD CONSTRAINT check_trusted_operations_op_type CHECK (
        op_type IN (
            'provision_owner',
            'member_add',
            'member_update_role',
            'member_remove',
            'transfer_promote_target',
            'transfer_demote_actor'
        )
    ),
    ADD CONSTRAINT check_trusted_operations_tg_op CHECK (
        expected_tg_op IN ('INSERT', 'UPDATE', 'DELETE')
    );

CREATE INDEX IF NOT EXISTS idx_trusted_operations_lookup
    ON creatoros_internal.trusted_operations (txid, expected_tg_op, workspace_id, target_user_id);

ALTER TABLE creatoros_internal.trusted_operations OWNER TO postgres;
ALTER TABLE creatoros_internal.trusted_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE creatoros_internal.trusted_operations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE creatoros_internal.trusted_operations_id_seq FROM PUBLIC, anon, authenticated, service_role;

-- 5B. Per-workspace serialization lock & version table (Level 1 lock boundary)
CREATE TABLE IF NOT EXISTS creatoros_internal.workspace_locks (
    workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    lock_version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

DO $$
BEGIN
    -- Clean any stale lock entries for deleted workspaces if upgrading from a table without FK
    DELETE FROM creatoros_internal.workspace_locks wl
    WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = wl.workspace_id);

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint c
        WHERE c.conrelid = 'creatoros_internal.workspace_locks'::pg_catalog.regclass
          AND c.contype = 'f'
    ) THEN
        ALTER TABLE creatoros_internal.workspace_locks
            ADD CONSTRAINT workspace_locks_workspace_id_fkey
            FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;
END;
$$;

ALTER TABLE creatoros_internal.workspace_locks OWNER TO postgres;
ALTER TABLE creatoros_internal.workspace_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE creatoros_internal.workspace_locks FROM PUBLIC, anon, authenticated, service_role;

-- 5C. Transaction-bound INSERT ... RETURNING state tracking for `public.workspaces`
-- Registered in BEFORE INSERT and deleted immediately in AFTER INSERT (`handle_new_workspace`)
CREATE TABLE IF NOT EXISTS creatoros_internal.pending_workspace_inserts (
    workspace_id UUID PRIMARY KEY,
    txid xid8 NOT NULL DEFAULT pg_catalog.pg_current_xact_id(),
    creator_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

DO $$ BEGIN
    DELETE FROM creatoros_internal.pending_workspace_inserts;
END $$;

ALTER TABLE creatoros_internal.pending_workspace_inserts OWNER TO postgres;
ALTER TABLE creatoros_internal.pending_workspace_inserts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE creatoros_internal.pending_workspace_inserts FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. PRE-CONSTRAINT LEGACY DATA SANITIZATION & VALIDATION
-- Ensures legacy rows with out-of-range formatting are normalized BEFORE adding
-- CHECK constraints, while failing loudly on unknown security roles.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_invalid_role_count BIGINT;
BEGIN
    -- Fail loudly if any legacy workspace_members row has an unrecognized security role
    SELECT pg_catalog.count(*) INTO v_invalid_role_count
    FROM public.workspace_members wm
    WHERE wm.role NOT IN ('owner', 'admin', 'editor', 'viewer', 'member');

    IF v_invalid_role_count > 0 THEN
        RAISE EXCEPTION 'Migration halted: Found % legacy workspace_members row(s) with invalid role values.', v_invalid_role_count;
    END IF;

    -- Sanitize ONLY out-of-bounds legacy profiles (never overwrites valid user customizations)
    UPDATE public.profiles p
    SET full_name = CASE
        WHEN pg_catalog.char_length(pg_catalog.btrim(COALESCE(p.full_name, ''))) < 2
            THEN 'Creator ' || pg_catalog.lower(pg_catalog.substr(pg_catalog.replace(p.id::text, '-', ''), 1, 6))
        ELSE pg_catalog.substr(pg_catalog.btrim(p.full_name), 1, 100)
    END
    WHERE pg_catalog.char_length(pg_catalog.btrim(COALESCE(p.full_name, ''))) < 2
       OR pg_catalog.char_length(p.full_name) > 100;

    UPDATE public.profiles p
    SET preferred_language = 'id'
    WHERE p.preferred_language NOT IN ('id', 'en');

    UPDATE public.profiles p
    SET theme_preference = 'system'
    WHERE p.theme_preference NOT IN ('dark', 'light', 'system');

    UPDATE public.profiles p
    SET avatar_url = NULL
    WHERE p.avatar_url IS NOT NULL
      AND (
          p.avatar_url !~ '^https?://[^\s<>"'']+$'
          OR pg_catalog.char_length(p.avatar_url) > 2048
      );

    -- Sanitize ONLY out-of-bounds legacy workspaces
    UPDATE public.workspaces w
    SET name = CASE
        WHEN pg_catalog.char_length(pg_catalog.btrim(COALESCE(w.name, ''))) < 2
            THEN 'Workspace ' || pg_catalog.lower(pg_catalog.substr(pg_catalog.replace(w.id::text, '-', ''), 1, 6))
        ELSE pg_catalog.substr(pg_catalog.btrim(w.name), 1, 100)
    END
    WHERE pg_catalog.char_length(pg_catalog.btrim(COALESCE(w.name, ''))) < 2
       OR pg_catalog.char_length(w.name) > 100;

    UPDATE public.workspaces w
    SET slug = 'ws-' || pg_catalog.lower(pg_catalog.replace(w.id::text, '-', ''))
    WHERE w.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       OR pg_catalog.char_length(w.slug) < 2
       OR pg_catalog.char_length(w.slug) > 80
       OR w.slug IN (
           'admin', 'api', 'auth', 'dashboard', 'settings',
           'sign-in', 'sign-up', 'forgot-password', 'studio', 'strategy',
           'creator-profile', 'niche-discovery', 'billing', 'onboarding',
           'system', 'internal', 'public', 'login', 'logout', 'register'
       );

    UPDATE public.workspaces w
    SET creator_mode = 'creator'
    WHERE w.creator_mode NOT IN ('creator', 'affiliate', 'business', 'personal_brand');

    UPDATE public.workspaces w
    SET logo_url = NULL
    WHERE w.logo_url IS NOT NULL
      AND (
          w.logo_url !~ '^https?://[^\s<>"'']+$'
          OR pg_catalog.char_length(w.logo_url) > 2048
      );

    -- Sanitize ONLY out-of-bounds legacy workspace_settings
    UPDATE public.workspace_settings ws
    SET default_language = 'id'
    WHERE ws.default_language NOT IN ('id', 'en');

    UPDATE public.workspace_settings ws
    SET default_ai_model = 'gemini-1.5-flash'
    WHERE ws.default_ai_model !~ '^[a-zA-Z0-9._:-]+$'
       OR pg_catalog.char_length(ws.default_ai_model) > 100;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. CHECK CONSTRAINTS (Bounded by conrelid for Strict Schema Isolation)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- profiles constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_profiles_full_name'
          AND conrelid = 'public.profiles'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_full_name
            CHECK (pg_catalog.char_length(pg_catalog.btrim(full_name)) >= 2 AND pg_catalog.char_length(full_name) <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_profiles_language'
          AND conrelid = 'public.profiles'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_language
            CHECK (preferred_language IN ('id', 'en'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_profiles_theme'
          AND conrelid = 'public.profiles'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_theme
            CHECK (theme_preference IN ('dark', 'light', 'system'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_profiles_avatar_url'
          AND conrelid = 'public.profiles'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_avatar_url
            CHECK (
                avatar_url IS NULL
                OR (
                    avatar_url ~ '^https?://[^\s<>"'']+$'
                    AND pg_catalog.char_length(avatar_url) <= 2048
                )
            );
    END IF;

    -- workspaces constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_workspaces_name'
          AND conrelid = 'public.workspaces'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_name
            CHECK (pg_catalog.char_length(pg_catalog.btrim(name)) >= 2 AND pg_catalog.char_length(name) <= 100);
    END IF;

    ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS check_workspaces_slug;
    ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_slug
        CHECK (
            slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
            AND pg_catalog.char_length(slug) >= 2
            AND pg_catalog.char_length(slug) <= 80
            AND slug NOT IN (
                'admin', 'api', 'auth', 'dashboard', 'settings',
                'sign-in', 'sign-up', 'forgot-password', 'studio', 'strategy',
                'creator-profile', 'niche-discovery', 'billing', 'onboarding',
                'system', 'internal', 'public', 'login', 'logout', 'register'
            )
        );

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_workspaces_creator_mode'
          AND conrelid = 'public.workspaces'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_creator_mode
            CHECK (creator_mode IN ('creator', 'affiliate', 'business', 'personal_brand'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_workspaces_logo_url'
          AND conrelid = 'public.workspaces'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_logo_url
            CHECK (
                logo_url IS NULL
                OR (
                    logo_url ~ '^https?://[^\s<>"'']+$'
                    AND pg_catalog.char_length(logo_url) <= 2048
                )
            );
    END IF;

    -- workspace_members constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_workspace_members_role'
          AND conrelid = 'public.workspace_members'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT check_workspace_members_role
            CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member'));
    END IF;

    -- workspace_settings constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'check_workspace_settings_language'
          AND conrelid = 'public.workspace_settings'::pg_catalog.regclass
    ) THEN
        ALTER TABLE public.workspace_settings ADD CONSTRAINT check_workspace_settings_language
            CHECK (default_language IN ('id', 'en'));
    END IF;

    ALTER TABLE public.workspace_settings DROP CONSTRAINT IF EXISTS check_workspace_settings_ai_model;
    ALTER TABLE public.workspace_settings ADD CONSTRAINT check_workspace_settings_ai_model
        CHECK (
            default_ai_model ~ '^[a-zA-Z0-9._:-]+$'
            AND pg_catalog.char_length(default_ai_model) <= 100
        );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_active ON public.workspaces(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(workspace_id, role);
CREATE INDEX IF NOT EXISTS idx_workspace_settings_ws ON public.workspace_settings(workspace_id);

-- ------------------------------------------------------------------------------
-- 9. TIMESTAMP & TENANT METADATA INTEGRITY TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_workspace_members_updated_at
    BEFORE UPDATE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trigger_workspace_settings_updated_at
    BEFORE UPDATE ON public.workspace_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforces immutable identity keys, audit timestamps, and owner-only slug/soft-delete
-- mutations across profiles, workspaces, and workspace_settings.
-- Uses SECURITY DEFINER strictly so it can verify `auth.users` deletion during
-- `ON DELETE SET NULL` and owner membership without granting client SELECT on `auth.users`.
CREATE OR REPLACE FUNCTION public.enforce_immutable_tenant_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller UUID;
BEGIN
    IF TG_TABLE_NAME = 'workspaces' THEN
        IF NEW.id <> OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Data integrity violation: Workspace id and created_at are immutable.';
        END IF;

        IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            -- Permit transition to NULL exclusively when the original creator's auth.users row
            -- has been deleted (`ON DELETE SET NULL` referential action).
            IF NOT (
                OLD.created_by IS NOT NULL
                AND NEW.created_by IS NULL
                AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.created_by)
            ) THEN
                RAISE EXCEPTION 'Data integrity violation: Workspace id and created_by are immutable.';
            END IF;
        END IF;

        v_caller := (SELECT auth.uid());
        IF v_caller IS NOT NULL THEN
            IF NEW.slug IS DISTINCT FROM OLD.slug THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.workspace_members wm
                    WHERE wm.workspace_id = OLD.id
                      AND wm.user_id = v_caller
                      AND wm.role = 'owner'
                ) THEN
                    RAISE EXCEPTION 'Privilege violation: Only workspace owners can modify workspace slug.';
                END IF;
            END IF;

            IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.workspace_members wm
                    WHERE wm.workspace_id = OLD.id
                      AND wm.user_id = v_caller
                      AND wm.role = 'owner'
                ) THEN
                    RAISE EXCEPTION 'Privilege violation: Only workspace owners can archive or restore a workspace.';
                END IF;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'workspace_settings' THEN
        IF NEW.id <> OLD.id
           OR NEW.workspace_id <> OLD.workspace_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
        THEN
            RAISE EXCEPTION 'Data integrity violation: Workspace settings identity (id, workspace_id, created_at) is immutable.';
        END IF;
    ELSIF TG_TABLE_NAME = 'profiles' THEN
        IF NEW.id <> OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Data integrity violation: Profile id and created_at are immutable.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_immutable_tenant_keys() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_immutable_tenant_keys() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trigger_workspaces_immutable_keys
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_tenant_keys();

CREATE OR REPLACE TRIGGER trigger_workspace_settings_immutable_keys
    BEFORE UPDATE ON public.workspace_settings
    FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_tenant_keys();

CREATE OR REPLACE TRIGGER trigger_profiles_immutable_keys
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_tenant_keys();

-- Enforces `created_by IS NOT NULL` and `deleted_at IS NULL` on INSERT, and registers
-- transaction-bound `pending_workspace_inserts` entry for `INSERT ... RETURNING` RLS verification.
CREATE OR REPLACE FUNCTION public.prepare_workspace_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
        RAISE EXCEPTION 'Data integrity violation: Workspace created_by cannot be NULL on creation.';
    END IF;

    IF NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Data integrity violation: Workspace cannot be created in a soft-deleted state.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.created_by) THEN
        RAISE EXCEPTION 'Invalid creator: User % does not exist.', NEW.created_by;
    END IF;

    INSERT INTO creatoros_internal.pending_workspace_inserts (
        workspace_id,
        txid,
        creator_user_id,
        created_at
    )
    VALUES (
        NEW.id,
        pg_catalog.pg_current_xact_id(),
        NEW.created_by,
        pg_catalog.now()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
        txid = pg_catalog.pg_current_xact_id(),
        creator_user_id = EXCLUDED.creator_user_id,
        created_at = pg_catalog.now();

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.prepare_workspace_insert() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prepare_workspace_insert() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trigger_prepare_workspace_insert
    BEFORE INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.prepare_workspace_insert();

-- ------------------------------------------------------------------------------
-- 10. INTERNAL LOCKING, TOKEN ISSUANCE & PROVISIONING (creatoros_internal)
-- Strictly inaccessible to PUBLIC, anon, authenticated, and service_role.
-- ------------------------------------------------------------------------------

-- Canonical Level 1 Workspace Boundary Lock.
-- MUST be acquired BEFORE locking any Level 2 `public.workspace_members` rows.
-- Combines `public.workspaces FOR UPDATE` with a tuple version increment in
-- `creatoros_internal.workspace_locks` so concurrent mutations conflict across
-- READ COMMITTED, REPEATABLE READ (`SQLSTATE 40001`), and SERIALIZABLE (`SQLSTATE 40001`).
CREATE OR REPLACE FUNCTION creatoros_internal.lock_workspace_boundary(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    IF p_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Invalid workspace lock target: workspace_id cannot be NULL.';
    END IF;

    SELECT TRUE INTO v_exists
    FROM public.workspaces w
    WHERE w.id = p_workspace_id
    FOR UPDATE;

    IF NOT COALESCE(v_exists, FALSE) THEN
        RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
    END IF;

    INSERT INTO creatoros_internal.workspace_locks (workspace_id, lock_version, updated_at)
    VALUES (p_workspace_id, 1, pg_catalog.now())
    ON CONFLICT (workspace_id)
    DO UPDATE SET
        lock_version = creatoros_internal.workspace_locks.lock_version + 1,
        updated_at = pg_catalog.now();
END;
$$;

ALTER FUNCTION creatoros_internal.lock_workspace_boundary(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION creatoros_internal.lock_workspace_boundary(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- Issues a single-use, transaction-bound internal authorization token.
CREATE OR REPLACE FUNCTION creatoros_internal.issue_trusted_token(
    p_op_type VARCHAR,
    p_expected_tg_op VARCHAR,
    p_workspace_id UUID,
    p_actor_user_id UUID,
    p_target_user_id UUID,
    p_expected_old_role VARCHAR,
    p_expected_new_role VARCHAR
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_id BIGINT;
BEGIN
    INSERT INTO creatoros_internal.trusted_operations (
        txid,
        op_type,
        expected_tg_op,
        workspace_id,
        actor_user_id,
        target_user_id,
        expected_old_role,
        expected_new_role,
        created_at
    )
    VALUES (
        pg_catalog.pg_current_xact_id(),
        p_op_type,
        p_expected_tg_op,
        p_workspace_id,
        p_actor_user_id,
        p_target_user_id,
        p_expected_old_role,
        p_expected_new_role,
        pg_catalog.now()
    )
    RETURNING id INTO v_token_id;

    RETURN v_token_id;
END;
$$;

ALTER FUNCTION creatoros_internal.issue_trusted_token(VARCHAR, VARCHAR, UUID, UUID, UUID, VARCHAR, VARCHAR) OWNER TO postgres;
REVOKE ALL ON FUNCTION creatoros_internal.issue_trusted_token(VARCHAR, VARCHAR, UUID, UUID, UUID, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated, service_role;

-- Internal atomic owner membership provisioning for newly created or orphaned workspaces.
-- Enforces Level 1 (workspace boundary) -> Level 2 (workspace_members) lock order.
CREATE OR REPLACE FUNCTION creatoros_internal.provision_workspace_owner(
    p_workspace_id UUID,
    p_owner_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_existing_id UUID;
    v_existing_role VARCHAR;
    v_token_id BIGINT;
    v_rows INT;
BEGIN
    IF p_workspace_id IS NULL OR p_owner_user_id IS NULL THEN
        RAISE EXCEPTION 'Provisioning error: workspace_id and owner_user_id cannot be NULL.';
    END IF;

    -- Level 1: Lock workspace boundary first
    PERFORM creatoros_internal.lock_workspace_boundary(p_workspace_id);

    -- Level 2: Lock existing membership row if present
    SELECT wm.id, wm.role INTO v_existing_id, v_existing_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = p_owner_user_id
    FOR UPDATE;

    IF v_existing_id IS NULL THEN
        v_token_id := creatoros_internal.issue_trusted_token(
            'provision_owner',
            'INSERT',
            p_workspace_id,
            p_owner_user_id,
            p_owner_user_id,
            NULL,
            'owner'
        );

        INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
        VALUES (p_workspace_id, p_owner_user_id, 'owner', pg_catalog.now(), pg_catalog.now());

        GET DIAGNOSTICS v_rows = ROW_COUNT;
    ELSIF v_existing_role <> 'owner' THEN
        v_token_id := creatoros_internal.issue_trusted_token(
            'provision_owner',
            'UPDATE',
            p_workspace_id,
            p_owner_user_id,
            p_owner_user_id,
            v_existing_role,
            'owner'
        );

        UPDATE public.workspace_members
        SET role = 'owner', updated_at = pg_catalog.now()
        WHERE id = v_existing_id;

        GET DIAGNOSTICS v_rows = ROW_COUNT;
    ELSE
        -- Already provisioned as owner
        RETURN;
    END IF;

    IF v_rows <> 1 OR EXISTS (SELECT 1 FROM creatoros_internal.trusted_operations WHERE id = v_token_id) THEN
        RAISE EXCEPTION 'Provisioning token consumption invariant failed for workspace %.', p_workspace_id;
    END IF;
END;
$$;

ALTER FUNCTION creatoros_internal.provision_workspace_owner(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION creatoros_internal.provision_workspace_owner(UUID, UUID) FROM PUBLIC, anon, authenticated, service_role;

-- Internal idempotent user account + owned personal workspace provisioning.
-- Enforces invariant: EVERY user in `auth.users` must own (`role = 'owner'`) at least
-- one workspace. Non-owner memberships in other workspaces never satisfy this invariant.
CREATE OR REPLACE FUNCTION creatoros_internal.provision_user_account(
    p_user_id UUID,
    p_email TEXT,
    p_raw_user_meta_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_name TEXT;
    v_base_slug TEXT;
    v_workspace_slug TEXT;
    v_workspace_name TEXT;
    v_workspace_id UUID;
    v_uuid_hex TEXT;
    v_attempt INT;
    v_has_profile BOOLEAN;
    v_has_workspace BOOLEAN;
    v_has_owner BOOLEAN;
    v_has_settings BOOLEAN;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Provisioning error: user_id cannot be NULL.';
    END IF;

    -- Serialize concurrent provisioning attempts for the same user_id
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('creatoros_user_prov:' || p_user_id::text, 20261030)
    );

    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
        RAISE EXCEPTION 'Provisioning error: auth.users record % does not exist.', p_user_id;
    END IF;

    -- 1. Sanitize fallback display name (2..100 chars)
    v_user_name := COALESCE(
        NULLIF(pg_catalog.btrim(COALESCE(p_raw_user_meta_data->>'full_name', '')), ''),
        NULLIF(pg_catalog.btrim(pg_catalog.split_part(COALESCE(p_email, ''), '@', 1)), ''),
        'Creator'
    );
    v_user_name := pg_catalog.substr(v_user_name, 1, 90);

    IF pg_catalog.char_length(pg_catalog.btrim(v_user_name)) < 2 THEN
        v_user_name := 'Creator ' || pg_catalog.lower(pg_catalog.substr(pg_catalog.replace(p_user_id::text, '-', ''), 1, 6));
    END IF;

    -- 2. Create Profile idempotently without overwriting existing user customizations
    INSERT INTO public.profiles (
        id,
        full_name,
        preferred_language,
        theme_preference,
        onboarding_completed,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        v_user_name,
        'id',
        'system',
        FALSE,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO NOTHING;

    SELECT p.full_name INTO v_user_name
    FROM public.profiles p
    WHERE p.id = p_user_id;

    -- 3. Check strictly whether user already OWNS at least one ACTIVE workspace (`role = 'owner'` AND `deleted_at IS NULL`).
    -- Ordinary non-owner memberships or soft-deleted workspaces never satisfy this invariant!
    SELECT wm.workspace_id INTO v_workspace_id
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = p_user_id
      AND wm.role = 'owner'
      AND w.deleted_at IS NULL
    ORDER BY wm.created_at ASC, wm.id ASC
    LIMIT 1;

    -- 4. If user owns no active workspace yet, reclaim an orphaned active workspace created by this user
    -- ONLY if that workspace currently has ZERO owners (never hijack transferred workspaces).
    IF v_workspace_id IS NULL THEN
        SELECT w.id INTO v_workspace_id
        FROM public.workspaces w
        WHERE w.created_by = p_user_id
          AND w.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = w.id
                AND wm.role = 'owner'
          )
        ORDER BY w.created_at ASC, w.id ASC
        LIMIT 1;

        IF v_workspace_id IS NOT NULL THEN
            PERFORM creatoros_internal.provision_workspace_owner(v_workspace_id, p_user_id);
        END IF;
    END IF;

    -- 5. Allocate new personal workspace with INSERT-time unique_violation recovery
    IF v_workspace_id IS NULL THEN
        v_base_slug := pg_catalog.lower(pg_catalog.regexp_replace(v_user_name, '[^a-zA-Z0-9]+', '-', 'g'));
        v_base_slug := pg_catalog.btrim(v_base_slug, '-');
        v_base_slug := pg_catalog.substr(v_base_slug, 1, 40);
        v_base_slug := pg_catalog.btrim(v_base_slug, '-');

        IF v_base_slug IS NULL OR pg_catalog.char_length(v_base_slug) < 2 THEN
            v_base_slug := 'workspace';
        END IF;

        v_workspace_name := pg_catalog.substr(v_user_name || '''s Workspace', 1, 100);

        FOR v_attempt IN 1..10 LOOP
            IF v_attempt = 1 THEN
                v_uuid_hex := pg_catalog.lower(pg_catalog.replace(p_user_id::text, '-', ''));
            ELSE
                v_uuid_hex := pg_catalog.lower(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''));
            END IF;

            -- Max length: 40 + 1 + 32 = 73 chars (<= 80 limit of check_workspaces_slug)
            v_workspace_slug := v_base_slug || '-' || v_uuid_hex;

            BEGIN
                INSERT INTO public.workspaces (
                    name,
                    slug,
                    creator_mode,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (
                    v_workspace_name,
                    v_workspace_slug,
                    'creator',
                    p_user_id,
                    pg_catalog.now(),
                    pg_catalog.now()
                )
                RETURNING id INTO v_workspace_id;

                EXIT;
            EXCEPTION WHEN unique_violation THEN
                v_workspace_id := NULL;
            END;
        END LOOP;

        IF v_workspace_id IS NULL THEN
            RAISE EXCEPTION 'Provisioning failure: Could not allocate a unique workspace slug for user % after 10 full-UUID attempts.', p_user_id;
        END IF;
    END IF;

    -- 6. Ensure workspace_settings exist without overwriting existing customizations
    INSERT INTO public.workspace_settings (
        workspace_id,
        default_language,
        default_ai_model,
        created_at,
        updated_at
    )
    VALUES (
        v_workspace_id,
        'id',
        'gemini-1.5-flash',
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (workspace_id) DO NOTHING;

    -- 7. Strict post-condition integrity assertions (atomic rollback if any fails)
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = p_user_id
    ) INTO v_has_profile;

    SELECT EXISTS (
        SELECT 1 FROM public.workspaces w WHERE w.id = v_workspace_id AND w.deleted_at IS NULL
    ) INTO v_has_workspace;

    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = v_workspace_id
          AND wm.user_id = p_user_id
          AND wm.role = 'owner'
    ) INTO v_has_owner;

    SELECT EXISTS (
        SELECT 1 FROM public.workspace_settings ws
        WHERE ws.workspace_id = v_workspace_id
    ) INTO v_has_settings;

    IF NOT (v_has_profile AND v_has_workspace AND v_has_owner AND v_has_settings) THEN
        RAISE EXCEPTION 'Provisioning integrity failure for user %: incomplete tenant state (profile=%, workspace=%, owner=%, settings=%).',
            p_user_id, v_has_profile, v_has_workspace, v_has_owner, v_has_settings;
    END IF;

    RETURN v_workspace_id;
END;
$$;

ALTER FUNCTION creatoros_internal.provision_user_account(UUID, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION creatoros_internal.provision_user_account(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. RLS HELPER FUNCTIONS (SECURITY DEFINER with empty search_path)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_workspace_access(
    ws_id UUID,
    minimum_role VARCHAR DEFAULT 'viewer'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
    current_caller UUID;
    user_role VARCHAR;
BEGIN
    IF ws_id IS NULL OR minimum_role IS NULL THEN
        RETURN FALSE;
    END IF;

    current_caller := (SELECT auth.uid());
    IF current_caller IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT wm.role INTO user_role
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = current_caller
      AND w.deleted_at IS NULL;

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    IF minimum_role IN ('viewer', 'member') THEN
        RETURN user_role IN ('owner', 'admin', 'editor', 'viewer', 'member');
    ELSIF minimum_role = 'editor' THEN
        RETURN user_role IN ('owner', 'admin', 'editor');
    ELSIF minimum_role = 'admin' THEN
        RETURN user_role IN ('owner', 'admin');
    ELSIF minimum_role = 'owner' THEN
        RETURN user_role = 'owner';
    END IF;

    RETURN FALSE;
END;
$$;

ALTER FUNCTION public.has_workspace_access(UUID, VARCHAR) OWNER TO postgres;

-- Deterministic state-bound helper for `INSERT INTO public.workspaces ... RETURNING *`.
-- Evaluates TRUE strictly when `BEFORE INSERT` registered `(ws_id, pg_current_xact_id(), auth.uid())`
-- in `creatoros_internal.pending_workspace_inserts` AND `AFTER INSERT` (`handle_new_workspace`)
-- has not yet populated `public.workspace_members` and cleared the pending record.
-- Marked VOLATILE intentionally so PL/pgSQL SPI uses the latest intra-transaction CommandId.
CREATE OR REPLACE FUNCTION public.is_workspace_creator_during_insert(
    ws_id UUID,
    ws_created_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
VOLATILE
AS $$
DECLARE
    current_caller UUID;
BEGIN
    IF ws_id IS NULL OR ws_created_by IS NULL THEN
        RETURN FALSE;
    END IF;

    current_caller := (SELECT auth.uid());
    IF current_caller IS NULL OR current_caller <> ws_created_by THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM creatoros_internal.pending_workspace_inserts p
        WHERE p.workspace_id = ws_id
          AND p.txid = pg_catalog.pg_current_xact_id()
          AND p.creator_user_id = current_caller
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = ws_id
    );
END;
$$;

ALTER FUNCTION public.is_workspace_creator_during_insert(UUID, UUID) OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 12. TRIGGER: Enforce Single-Use Token Verification, RBAC & Owner Invariants
-- Defense-in-depth trigger on `public.workspace_members`:
--  - Rejects all un-tokenized direct DML (even from `service_role` or superuser SQL).
--  - Atomically consumes (`DELETE ... RETURNING`) the single-use token matching
--    (txid, expected_tg_op, workspace_id, target_user_id, expected_old_role, expected_new_role).
--  - Independently re-verifies `auth.uid() = actor_user_id`, RBAC hierarchy,
--    immutability of `(id, workspace_id, user_id, created_at)`, co-owner protection, and
--    last-owner protection.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_workspace_member_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ws_id UUID;
    v_target_uid UUID;
    v_old_role VARCHAR;
    v_new_role VARCHAR;
    v_op_type VARCHAR;
    v_token_actor_id UUID;
    v_caller_id UUID;
    v_caller_role VARCHAR;
    v_owner_count BIGINT;
BEGIN
    -- =========================================================================
    -- 0. CASCADE DELETION HANDLING (Parent Workspace or Auth User Deleted)
    -- =========================================================================
    IF TG_OP = 'DELETE' THEN
        -- Parent workspace deleted -> allow cascade cleanup without taking upward locks
        IF NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = OLD.workspace_id) THEN
            RETURN OLD;
        END IF;

        -- Referenced auth.users row deleted -> `handle_auth_user_deletion` BEFORE DELETE
        -- already locked workspace boundaries in `id ASC` order; verify >=1 owner remains!
        IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.user_id) THEN
            IF OLD.role = 'owner' THEN
                SELECT pg_catalog.count(*) INTO v_owner_count
                FROM public.workspace_members wm
                WHERE wm.workspace_id = OLD.workspace_id
                  AND wm.role = 'owner';

                IF v_owner_count <= 1 THEN
                    RAISE EXCEPTION 'Owner protection violation: Cannot remove the last remaining owner while workspace exists.';
                END IF;
            END IF;
            RETURN OLD;
        END IF;
    END IF;

    -- =========================================================================
    -- 1. UNCONDITIONAL MEMBERSHIP IDENTITY & TIMESTAMP IMMUTABILITY ON UPDATE
    -- =========================================================================
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id <> OLD.id
           OR NEW.workspace_id <> OLD.workspace_id
           OR NEW.user_id <> OLD.user_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
        THEN
            RAISE EXCEPTION 'Data integrity violation: Membership identity (id, workspace_id, user_id, created_at) is immutable.';
        END IF;
    END IF;

    -- =========================================================================
    -- 2. ATOMIC SINGLE-USE TOKEN VERIFICATION & CONSUMPTION
    -- =========================================================================
    v_ws_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
    v_target_uid := COALESCE(NEW.user_id, OLD.user_id);
    v_old_role := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.role ELSE NULL END;
    v_new_role := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.role ELSE NULL END;

    DELETE FROM creatoros_internal.trusted_operations
    WHERE id = (
        SELECT to_op.id
        FROM creatoros_internal.trusted_operations to_op
        WHERE to_op.txid = pg_catalog.pg_current_xact_id()
          AND to_op.expected_tg_op = TG_OP
          AND to_op.workspace_id = v_ws_id
          AND to_op.target_user_id = v_target_uid
          AND to_op.expected_old_role IS NOT DISTINCT FROM v_old_role
          AND to_op.expected_new_role IS NOT DISTINCT FROM v_new_role
        ORDER BY to_op.id ASC
        LIMIT 1
    )
    RETURNING op_type, actor_user_id INTO v_op_type, v_token_actor_id;

    IF v_op_type IS NULL THEN
        IF v_old_role = 'owner' OR v_new_role = 'owner' THEN
            RAISE EXCEPTION 'Direct owner role modifications are prohibited. Use transfer_workspace_ownership() instead.';
        END IF;
        RAISE EXCEPTION 'Direct table modifications on workspace_members are prohibited. Use validated workspace membership RPC functions.';
    END IF;

    -- =========================================================================
    -- 3. INTERNAL PROVISIONING INVARIANT VERIFICATION (`provision_owner`)
    -- =========================================================================
    IF v_op_type = 'provision_owner' THEN
        IF TG_OP NOT IN ('INSERT', 'UPDATE')
           OR NEW.role <> 'owner'
           OR v_token_actor_id <> NEW.user_id
        THEN
            RAISE EXCEPTION 'Internal provisioning invariant violation: invalid token parameters.';
        END IF;

        -- Only the recorded `workspaces.created_by` of a workspace that currently has NO other
        -- owner can be provisioned via `provision_owner`.
        IF NOT EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = NEW.workspace_id
              AND w.created_by = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Internal provisioning invariant violation: user % is not creator of workspace %.', NEW.user_id, NEW.workspace_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = NEW.workspace_id
              AND wm.role = 'owner'
              AND wm.user_id <> NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Internal provisioning invariant violation: workspace % already has an active owner.', NEW.workspace_id;
        END IF;

        RETURN NEW;
    END IF;

    -- =========================================================================
    -- 4. AUTHENTICATED CALLER & ACTOR BINDING VERIFICATION
    -- =========================================================================
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Unauthenticated operations on workspace members are strictly forbidden.';
    END IF;

    IF v_token_actor_id <> v_caller_id THEN
        RAISE EXCEPTION 'Security violation: Token actor mismatch with authenticated user.';
    END IF;

    SELECT wm.role INTO v_caller_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = v_ws_id
      AND wm.user_id = v_caller_id;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not a member of this workspace.';
    END IF;

    -- =========================================================================
    -- 5. OPERATION-SPECIFIC RBAC & OWNERSHIP INVARIANTS
    -- =========================================================================
    IF v_op_type = 'member_add' THEN
        IF TG_OP <> 'INSERT' THEN
            RAISE EXCEPTION 'Invalid trigger operation for member_add.';
        END IF;

        IF NEW.role = 'owner' THEN
            RAISE EXCEPTION 'Role escalation rejected: Direct owner assignment is prohibited. Use transfer_workspace_ownership() instead.';
        END IF;

        IF NEW.role = 'admin' AND v_caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Role escalation rejected: Only workspace owners can assign the admin role.';
        END IF;

        IF v_caller_role = 'admin' AND NEW.role NOT IN ('editor', 'viewer', 'member') THEN
            RAISE EXCEPTION 'Privilege violation: Admins can only add editor, viewer, or member roles.';
        END IF;

        IF v_caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to add workspace members.';
        END IF;

        RETURN NEW;

    ELSIF v_op_type = 'member_update_role' THEN
        IF TG_OP <> 'UPDATE' THEN
            RAISE EXCEPTION 'Invalid trigger operation for member_update_role.';
        END IF;

        IF OLD.role = 'owner' OR NEW.role = 'owner' THEN
            RAISE EXCEPTION 'Direct owner role modifications are prohibited. Use transfer_workspace_ownership() instead.';
        END IF;

        IF (OLD.role = 'admin' OR NEW.role = 'admin') AND OLD.role <> NEW.role AND v_caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Role escalation rejected: Only workspace owners can grant or revoke the admin role.';
        END IF;

        IF v_caller_role = 'admin' AND OLD.role IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Privilege violation: Admins cannot modify owners or admins.';
        END IF;

        IF v_caller_role = 'admin' AND NEW.role NOT IN ('editor', 'viewer', 'member') THEN
            RAISE EXCEPTION 'Privilege violation: Admins can only assign editor, viewer, or member roles.';
        END IF;

        IF v_caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to update workspace members.';
        END IF;

        RETURN NEW;

    ELSIF v_op_type = 'transfer_promote_target' THEN
        IF TG_OP <> 'UPDATE'
           OR v_caller_role <> 'owner'
           OR NEW.user_id = v_caller_id
           OR NEW.role <> 'owner'
        THEN
            RAISE EXCEPTION 'Ownership transfer promotion invariant violation.';
        END IF;

        RETURN NEW;

    ELSIF v_op_type = 'transfer_demote_actor' THEN
        IF TG_OP <> 'UPDATE'
           OR OLD.user_id <> v_caller_id
           OR OLD.role <> 'owner'
           OR NEW.role <> 'admin'
        THEN
            RAISE EXCEPTION 'Ownership transfer demotion invariant violation.';
        END IF;

        SELECT pg_catalog.count(*) INTO v_owner_count
        FROM public.workspace_members wm
        WHERE wm.workspace_id = OLD.workspace_id
          AND wm.role = 'owner';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'Owner protection violation: The last remaining owner cannot be demoted. Transfer ownership first.';
        END IF;

        RETURN NEW;

    ELSIF v_op_type = 'member_remove' THEN
        IF TG_OP <> 'DELETE' THEN
            RAISE EXCEPTION 'Invalid trigger operation for member_remove.';
        END IF;

        IF v_caller_role = 'admin' AND OLD.role IN ('owner', 'admin') AND OLD.user_id <> v_caller_id THEN
            RAISE EXCEPTION 'Privilege violation: Admins cannot remove owners or other admins.';
        END IF;

        IF v_caller_role NOT IN ('owner', 'admin') AND v_caller_id <> OLD.user_id THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to remove this workspace member.';
        END IF;

        IF OLD.role = 'owner' THEN
            -- Explicit Co-Owner Policy: An owner CANNOT directly remove another owner;
            -- ownership must be consolidated via `transfer_workspace_ownership()` first.
            IF OLD.user_id <> v_caller_id THEN
                RAISE EXCEPTION 'Owner protection violation: Cannot remove another workspace owner directly. Ownership must be transferred via transfer_workspace_ownership() first.';
            END IF;

            SELECT pg_catalog.count(*) INTO v_owner_count
            FROM public.workspace_members wm
            WHERE wm.workspace_id = OLD.workspace_id
              AND wm.role = 'owner';

            IF v_owner_count <= 1 THEN
                RAISE EXCEPTION 'Owner protection violation: The last remaining owner cannot leave or be removed. Transfer ownership or remove the workspace.';
            END IF;
        END IF;

        RETURN OLD;
    END IF;

    RAISE EXCEPTION 'Unknown trusted operation type: %', v_op_type;
END;
$$;

ALTER FUNCTION public.enforce_workspace_member_safety() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_workspace_member_safety() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trigger_workspace_member_safety
    BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_member_safety();

-- ------------------------------------------------------------------------------
-- 13. VALIDATED WORKSPACE MEMBERSHIP RPC FUNCTIONS
-- All client membership changes execute through these 4 functions, guaranteeing
-- Level 1 (`lock_workspace_boundary`) -> Level 2 (`workspace_members id ASC`) locking
-- and single-use atomic token verification.
-- ------------------------------------------------------------------------------

-- 13A. Add Workspace Member
CREATE OR REPLACE FUNCTION public.add_workspace_member(
    target_workspace_id UUID,
    member_user_id UUID,
    member_role VARCHAR DEFAULT 'member'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role VARCHAR;
    v_token_id BIGINT;
    v_member_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR member_user_id IS NULL OR member_role IS NULL THEN
        RAISE EXCEPTION 'Invalid arguments: target_workspace_id, member_user_id, and member_role are required.';
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = target_workspace_id AND w.deleted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Invalid target: Workspace % has been archived or deleted.', target_workspace_id;
    END IF;

    -- Level 2 Lock: Caller & potential existing target row in deterministic `id ASC` order
    PERFORM 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id IN (v_caller_id, member_user_id)
    ORDER BY wm.id ASC
    FOR UPDATE;

    SELECT wm.role INTO v_caller_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = v_caller_id;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not a member of this workspace.';
    END IF;

    IF v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to add workspace members.';
    END IF;

    IF member_role = 'owner' THEN
        RAISE EXCEPTION 'Role escalation rejected: Direct owner assignment is prohibited. Add the user as a member first, then use transfer_workspace_ownership().';
    END IF;

    IF member_role NOT IN ('admin', 'editor', 'viewer', 'member') THEN
        RAISE EXCEPTION 'Invalid role: %', member_role;
    END IF;

    IF member_role = 'admin' AND v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Role escalation rejected: Only workspace owners can assign the admin role.';
    END IF;

    IF v_caller_role = 'admin' AND member_role NOT IN ('editor', 'viewer', 'member') THEN
        RAISE EXCEPTION 'Privilege violation: Admins can only add editor, viewer, or member roles.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.user_id = member_user_id
    ) THEN
        RAISE EXCEPTION 'Conflict: User is already a member of this workspace.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = member_user_id) THEN
        RAISE EXCEPTION 'Invalid target: User does not exist.';
    END IF;

    v_token_id := creatoros_internal.issue_trusted_token(
        'member_add',
        'INSERT',
        target_workspace_id,
        v_caller_id,
        member_user_id,
        NULL,
        member_role
    );

    INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
    VALUES (target_workspace_id, member_user_id, member_role, pg_catalog.now(), pg_catalog.now())
    RETURNING id INTO v_member_id;

    IF v_member_id IS NULL OR EXISTS (SELECT 1 FROM creatoros_internal.trusted_operations WHERE id = v_token_id) THEN
        RAISE EXCEPTION 'Token consumption invariant failed during add_workspace_member.';
    END IF;

    RETURN v_member_id;
END;
$$;

ALTER FUNCTION public.add_workspace_member(UUID, UUID, VARCHAR) OWNER TO postgres;

-- 13B. Update Workspace Member Role
CREATE OR REPLACE FUNCTION public.update_workspace_member_role(
    target_workspace_id UUID,
    member_user_id UUID,
    new_role VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role VARCHAR;
    v_target_member_id UUID;
    v_old_role VARCHAR;
    v_token_id BIGINT;
    v_rows INT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR member_user_id IS NULL OR new_role IS NULL THEN
        RAISE EXCEPTION 'Invalid arguments: target_workspace_id, member_user_id, and new_role are required.';
    END IF;

    IF new_role NOT IN ('owner', 'admin', 'editor', 'viewer', 'member') THEN
        RAISE EXCEPTION 'Invalid role: %', new_role;
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = target_workspace_id AND w.deleted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Invalid target: Workspace % has been archived or deleted.', target_workspace_id;
    END IF;

    -- Level 2 Lock: Caller & target membership rows in deterministic `id ASC` order
    PERFORM 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id IN (v_caller_id, member_user_id)
    ORDER BY wm.id ASC
    FOR UPDATE;

    SELECT wm.role INTO v_caller_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = v_caller_id;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not a member of this workspace.';
    END IF;

    IF v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to update workspace members.';
    END IF;

    SELECT wm.id, wm.role INTO v_target_member_id, v_old_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = member_user_id;

    IF v_target_member_id IS NULL THEN
        RAISE EXCEPTION 'Target user is not a member of this workspace.';
    END IF;

    IF v_caller_role = 'admin' AND v_old_role IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Privilege violation: Admins cannot modify owners or admins.';
    END IF;

    IF v_old_role = 'owner' OR new_role = 'owner' THEN
        RAISE EXCEPTION 'Direct owner role modifications are prohibited. Use transfer_workspace_ownership() instead.';
    END IF;

    IF (v_old_role = 'admin' OR new_role = 'admin') AND v_old_role <> new_role AND v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Role escalation rejected: Only workspace owners can grant or revoke the admin role.';
    END IF;

    IF v_caller_role = 'admin' AND new_role NOT IN ('editor', 'viewer', 'member') THEN
        RAISE EXCEPTION 'Privilege violation: Admins can only assign editor, viewer, or member roles.';
    END IF;

    v_token_id := creatoros_internal.issue_trusted_token(
        'member_update_role',
        'UPDATE',
        target_workspace_id,
        v_caller_id,
        member_user_id,
        v_old_role,
        new_role
    );

    UPDATE public.workspace_members
    SET role = new_role, updated_at = pg_catalog.now()
    WHERE id = v_target_member_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows <> 1 OR EXISTS (SELECT 1 FROM creatoros_internal.trusted_operations WHERE id = v_token_id) THEN
        RAISE EXCEPTION 'Token consumption invariant failed during update_workspace_member_role.';
    END IF;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.update_workspace_member_role(UUID, UUID, VARCHAR) OWNER TO postgres;

-- 13C. Remove Workspace Member (or Self-Leave)
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
    target_workspace_id UUID,
    member_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role VARCHAR;
    v_target_member_id UUID;
    v_old_role VARCHAR;
    v_owner_count BIGINT;
    v_token_id BIGINT;
    v_rows INT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR member_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid arguments: target_workspace_id and member_user_id are required.';
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = target_workspace_id AND w.deleted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Invalid target: Workspace % has been archived or deleted.', target_workspace_id;
    END IF;

    -- Level 2 Lock: Caller, target, and any owner rows in deterministic `id ASC` order
    PERFORM 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND (wm.user_id IN (v_caller_id, member_user_id) OR wm.role = 'owner')
    ORDER BY wm.id ASC
    FOR UPDATE;

    SELECT wm.role INTO v_caller_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = v_caller_id;

    IF v_caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not a member of this workspace.';
    END IF;

    SELECT wm.id, wm.role INTO v_target_member_id, v_old_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = member_user_id;

    IF v_target_member_id IS NULL THEN
        RAISE EXCEPTION 'Target user is not a member of this workspace.';
    END IF;

    IF v_caller_role NOT IN ('owner', 'admin') AND v_caller_id <> member_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Insufficient permissions to remove this workspace member.';
    END IF;

    IF v_caller_role = 'admin' AND v_old_role IN ('owner', 'admin') AND v_caller_id <> member_user_id THEN
        RAISE EXCEPTION 'Privilege violation: Admins cannot remove owners or other admins.';
    END IF;

    IF v_old_role = 'owner' THEN
        IF v_caller_id <> member_user_id THEN
            RAISE EXCEPTION 'Owner protection violation: Cannot remove another workspace owner directly. Ownership must be transferred via transfer_workspace_ownership() first.';
        END IF;

        SELECT pg_catalog.count(*) INTO v_owner_count
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND wm.role = 'owner';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'Owner protection violation: The last remaining owner cannot leave or be removed. Transfer ownership or remove the workspace.';
        END IF;
    END IF;

    v_token_id := creatoros_internal.issue_trusted_token(
        'member_remove',
        'DELETE',
        target_workspace_id,
        v_caller_id,
        member_user_id,
        v_old_role,
        NULL
    );

    DELETE FROM public.workspace_members
    WHERE id = v_target_member_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows <> 1 OR EXISTS (SELECT 1 FROM creatoros_internal.trusted_operations WHERE id = v_token_id) THEN
        RAISE EXCEPTION 'Token consumption invariant failed during remove_workspace_member.';
    END IF;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.remove_workspace_member(UUID, UUID) OWNER TO postgres;

-- 13D. Atomic Ownership Transfer Function
-- Issues TWO distinct single-use tokens (`transfer_promote_target` for UPDATE #1 and
-- `transfer_demote_actor` for UPDATE #2), each atomically consumed on its exact row.
-- Failure of UPDATE #2 raises an uncaught exception and rolls back UPDATE #1 completely.
CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(
    target_workspace_id UUID,
    new_owner_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_member_id UUID;
    v_caller_role VARCHAR;
    v_target_member_id UUID;
    v_target_role VARCHAR;
    v_token_promote BIGINT;
    v_token_demote BIGINT;
    v_rows INT;
    v_remaining_owners BIGINT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Invalid target: Workspace id cannot be NULL.';
    END IF;

    IF new_owner_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid target: New owner user id cannot be NULL.';
    END IF;

    -- Level 1 Lock: Workspace boundary (verifies workspace exists + increments lock_version)
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = target_workspace_id AND w.deleted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Invalid target: Workspace % has been archived or deleted.', target_workspace_id;
    END IF;

    -- Level 2 Lock: Caller, recipient, and all owner rows in deterministic `id ASC` order
    PERFORM 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND (wm.user_id IN (v_caller_id, new_owner_user_id) OR wm.role = 'owner')
    ORDER BY wm.id ASC
    FOR UPDATE;

    -- Post-lock verification: Caller MUST still be an active owner
    SELECT wm.id, wm.role INTO v_caller_member_id, v_caller_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = v_caller_id;

    IF v_caller_member_id IS NULL OR v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Unauthorized: Only a workspace owner can transfer ownership.';
    END IF;

    -- Idempotent self-transfer check (only after confirming caller is an owner)
    IF v_caller_id = new_owner_user_id THEN
        RETURN TRUE;
    END IF;

    -- Verify recipient is an active member of target_workspace_id
    SELECT wm.id, wm.role INTO v_target_member_id, v_target_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = new_owner_user_id;

    IF v_target_member_id IS NULL THEN
        RAISE EXCEPTION 'Invalid target: Target user must already be a member of the workspace before receiving ownership.';
    END IF;

    -- STEP 1: Issue single-use promotion token & promote recipient to `owner`
    v_token_promote := creatoros_internal.issue_trusted_token(
        'transfer_promote_target',
        'UPDATE',
        target_workspace_id,
        v_caller_id,
        new_owner_user_id,
        v_target_role,
        'owner'
    );

    UPDATE public.workspace_members
    SET role = 'owner', updated_at = pg_catalog.now()
    WHERE id = v_target_member_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 OR EXISTS (SELECT 1 FROM creatoros_internal.trusted_operations WHERE id = v_token_promote) THEN
        RAISE EXCEPTION 'Ownership transfer promotion token invariant failed.';
    END IF;

    -- STEP 2: Issue single-use demotion token & demote caller from `owner` to `admin`
    v_token_demote := creatoros_internal.issue_trusted_token(
        'transfer_demote_actor',
        'UPDATE',
        target_workspace_id,
        v_caller_id,
        v_caller_id,
        'owner',
        'admin'
    );

    UPDATE public.workspace_members
    SET role = 'admin', updated_at = pg_catalog.now()
    WHERE id = v_caller_member_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 OR EXISTS (SELECT 1 FROM creatoros_internal.trusted_operations WHERE id = v_token_demote) THEN
        RAISE EXCEPTION 'Ownership transfer demotion token invariant failed.';
    END IF;

    -- Post-condition verification: recipient is owner, caller is admin, workspace has >= 1 owner
    SELECT pg_catalog.count(*) INTO v_remaining_owners
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.role = 'owner';

    IF v_remaining_owners < 1 THEN
        RAISE EXCEPTION 'Ownership transfer invariant failure: workspace % has zero owners.', target_workspace_id;
    END IF;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.transfer_workspace_ownership(UUID, UUID) OWNER TO postgres;

-- 13E. Atomic Workspace & Settings Configuration Update Function (Admin/Owner Only)
-- Enforces canonical Level 1 (`lock_workspace_boundary`) -> Level 2 (`workspace_members`)
-- -> Level 3 (`workspace_settings`) lock order and updates both tables atomically.
CREATE OR REPLACE FUNCTION public.update_workspace_configuration(
    target_workspace_id UUID,
    new_name TEXT,
    new_creator_mode VARCHAR,
    new_default_language VARCHAR DEFAULT 'id',
    new_default_ai_model VARCHAR DEFAULT 'gemini-1.5-flash',
    new_enable_auto_hashtag BOOLEAN DEFAULT TRUE,
    new_notify_on_publish BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role VARCHAR;
    v_trimmed_name TEXT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL
       OR new_name IS NULL
       OR new_creator_mode IS NULL
       OR new_default_language IS NULL
       OR new_default_ai_model IS NULL
       OR new_enable_auto_hashtag IS NULL
       OR new_notify_on_publish IS NULL
    THEN
        RAISE EXCEPTION 'Invalid arguments: All workspace configuration parameters are required.';
    END IF;

    v_trimmed_name := pg_catalog.btrim(new_name);
    IF pg_catalog.char_length(v_trimmed_name) < 2 OR pg_catalog.char_length(v_trimmed_name) > 100 THEN
        RAISE EXCEPTION 'Invalid workspace name: Length must be between 2 and 100 characters.';
    END IF;

    IF new_creator_mode NOT IN ('creator', 'affiliate', 'business', 'personal_brand') THEN
        RAISE EXCEPTION 'Invalid creator_mode: %', new_creator_mode;
    END IF;

    IF new_default_language NOT IN ('id', 'en') THEN
        RAISE EXCEPTION 'Invalid default_language: %', new_default_language;
    END IF;

    IF new_default_ai_model !~ '^[a-zA-Z0-9._:-]+$' OR pg_catalog.char_length(new_default_ai_model) > 100 THEN
        RAISE EXCEPTION 'Invalid default_ai_model format.';
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = target_workspace_id AND w.deleted_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Invalid target: Workspace % has been archived or deleted.', target_workspace_id;
    END IF;

    -- Level 2 Lock: Caller membership row
    SELECT wm.role INTO v_caller_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = v_caller_id
    FOR UPDATE;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only workspace owners or admins can update workspace configuration.';
    END IF;

    UPDATE public.workspaces
    SET name = v_trimmed_name,
        creator_mode = new_creator_mode,
        updated_at = pg_catalog.now()
    WHERE id = target_workspace_id;

    -- Level 3 Lock: Workspace settings upsert/update
    INSERT INTO public.workspace_settings (
        workspace_id,
        default_language,
        default_ai_model,
        enable_auto_hashtag,
        notify_on_publish,
        created_at,
        updated_at
    )
    VALUES (
        target_workspace_id,
        new_default_language,
        new_default_ai_model,
        new_enable_auto_hashtag,
        new_notify_on_publish,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
        default_language = EXCLUDED.default_language,
        default_ai_model = EXCLUDED.default_ai_model,
        enable_auto_hashtag = EXCLUDED.enable_auto_hashtag,
        notify_on_publish = EXCLUDED.notify_on_publish,
        updated_at = pg_catalog.now();

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.update_workspace_configuration(UUID, TEXT, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, BOOLEAN) OWNER TO postgres;

-- 13F. Validated Owner-Only Workspace Soft-Delete Function
-- Enforces Level 1 (`lock_workspace_boundary`) -> Level 2 (`workspace_members`) lock order,
-- verifies active `owner` role, and prevents soft-deleting a user's last active owned workspace.
CREATE OR REPLACE FUNCTION public.soft_delete_workspace(
    target_workspace_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role VARCHAR;
    v_other_active_owned BIGINT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Invalid target: Workspace id cannot be NULL.';
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = target_workspace_id AND w.deleted_at IS NOT NULL) THEN
        RETURN TRUE;
    END IF;

    -- Level 2 Lock: Caller membership row
    SELECT wm.role INTO v_caller_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = v_caller_id
    FOR UPDATE;

    IF v_caller_role IS NULL OR v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Unauthorized: Only a workspace owner can archive or remove a workspace.';
    END IF;

    SELECT pg_catalog.count(*) INTO v_other_active_owned
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = v_caller_id
      AND wm.role = 'owner'
      AND w.deleted_at IS NULL
      AND w.id <> target_workspace_id;

    IF v_other_active_owned < 1 THEN
        RAISE EXCEPTION 'Workspace protection violation: Cannot archive your only active owned workspace.';
    END IF;

    UPDATE public.workspaces
    SET deleted_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = target_workspace_id;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.soft_delete_workspace(UUID) OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 14. TRIGGER: Automatic Owner & Settings Creation on Workspace Insert
-- Clears `pending_workspace_inserts` immediately after provisioning owner & settings.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM creatoros_internal.provision_workspace_owner(NEW.id, NEW.created_by);

    INSERT INTO public.workspace_settings (
        workspace_id,
        default_language,
        default_ai_model,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        'id',
        'gemini-1.5-flash',
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (workspace_id) DO NOTHING;

    DELETE FROM creatoros_internal.pending_workspace_inserts
    WHERE workspace_id = NEW.id
      AND txid = pg_catalog.pg_current_xact_id();

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_workspace() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_workspace() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER on_workspace_created
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ------------------------------------------------------------------------------
-- 15. TRIGGERS ON `auth.users`: Sign-Up Provisioning & Safe Account Deletion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM creatoros_internal.provision_user_account(
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data
    );
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Account Deletion Lifecycle Guard (`BEFORE DELETE ON auth.users`):
-- 1. Acquires Level 1 locks (`lock_workspace_boundary`) on all affected workspaces in `id ASC` order.
-- 2. If user is sole remaining owner of a shared multi-member workspace -> BLOCKS deletion.
-- 3. If user is sole remaining owner AND sole member of a personal workspace -> deletes workspace cleanly.
-- 4. If shared workspace already has another active owner -> allows deletion (`created_by` sets NULL via FK).
CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ws RECORD;
    v_is_owner BOOLEAN;
    v_other_owners BIGINT;
    v_other_members BIGINT;
BEGIN
    -- Step 1: Lock all workspaces associated with this user in strict `id ASC` order (Level 1)
    FOR v_ws IN
        SELECT DISTINCT w.id
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm
          ON wm.workspace_id = w.id AND wm.user_id = OLD.id
        WHERE wm.user_id = OLD.id
           OR w.created_by = OLD.id
        ORDER BY w.id ASC
    LOOP
        PERFORM creatoros_internal.lock_workspace_boundary(v_ws.id);
    END LOOP;

    -- Step 2: Evaluate ownership obligations per workspace in deterministic `id ASC` order
    FOR v_ws IN
        SELECT w.id, w.deleted_at
        FROM public.workspaces w
        JOIN public.workspace_members wm
          ON wm.workspace_id = w.id
        WHERE wm.user_id = OLD.id
          AND wm.role = 'owner'
        ORDER BY w.id ASC
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = v_ws.id
              AND wm.user_id = OLD.id
              AND wm.role = 'owner'
        ) INTO v_is_owner;

        IF v_is_owner THEN
            SELECT pg_catalog.count(*) INTO v_other_owners
            FROM public.workspace_members wm
            WHERE wm.workspace_id = v_ws.id
              AND wm.role = 'owner'
              AND wm.user_id <> OLD.id;

            SELECT pg_catalog.count(*) INTO v_other_members
            FROM public.workspace_members wm
            WHERE wm.workspace_id = v_ws.id
              AND wm.user_id <> OLD.id;

            IF v_other_owners = 0 THEN
                IF v_ws.deleted_at IS NULL AND v_other_members > 0 THEN
                    RAISE EXCEPTION 'Account deletion blocked: User % is the sole remaining owner of shared workspace %. Transfer ownership or remove the workspace before deleting this account.',
                        OLD.id, v_ws.id;
                ELSE
                    -- Sole-member personal workspace OR sole-owner soft-deleted workspace:
                    -- delete cleanly (cascades membership & settings without trapping user deletion)
                    DELETE FROM public.workspaces w WHERE w.id = v_ws.id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN OLD;
END;
$$;

ALTER FUNCTION public.handle_auth_user_deletion() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_auth_user_deletion() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER before_auth_user_deleted
    BEFORE DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deletion();

-- ------------------------------------------------------------------------------
-- 16. BACKFILL: Idempotent, Canonical-Locking, Non-Destructive & Fail-Closed
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    u RECORD;
    w RECORD;
    v_orphan_ws_count BIGINT;
    v_missing_settings_count BIGINT;
    v_unprovisioned_user_count BIGINT;
BEGIN
    -- 1. Repair Orphaned Workspaces FIRST (workspaces lacking any `owner` member)
    FOR w IN
        SELECT ws.id, ws.created_by
        FROM public.workspaces ws
        WHERE NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = ws.id
              AND wm.role = 'owner'
        )
        ORDER BY ws.id ASC
    LOOP
        IF w.created_by IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = w.created_by) THEN
            RAISE EXCEPTION 'Backfill integrity error: Orphan workspace % has zero owners and no valid created_by user; manual remediation required.', w.id;
        END IF;

        PERFORM creatoros_internal.provision_workspace_owner(w.id, w.created_by);
    END LOOP;

    -- 2. Provision every existing user in `auth.users` (guarantees owned personal workspace,
    --    profile, and settings without overwriting existing customizations)
    FOR u IN
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        ORDER BY au.id ASC
    LOOP
        PERFORM creatoros_internal.provision_user_account(u.id, u.email, u.raw_user_meta_data);
    END LOOP;

    -- 3. Ensure every existing workspace has a `workspace_settings` record
    FOR w IN
        SELECT ws.id
        FROM public.workspaces ws
        WHERE NOT EXISTS (
            SELECT 1 FROM public.workspace_settings s
            WHERE s.workspace_id = ws.id
        )
        ORDER BY ws.id ASC
    LOOP
        INSERT INTO public.workspace_settings (
            workspace_id,
            default_language,
            default_ai_model,
            created_at,
            updated_at
        )
        VALUES (
            w.id,
            'id',
            'gemini-1.5-flash',
            pg_catalog.now(),
            pg_catalog.now()
        )
        ON CONFLICT (workspace_id) DO NOTHING;
    END LOOP;

    -- 4. Post-backfill global invariant verification (fail-closed)
    SELECT pg_catalog.count(*) INTO v_orphan_ws_count
    FROM public.workspaces ws
    WHERE NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = ws.id
          AND wm.role = 'owner'
    );

    SELECT pg_catalog.count(*) INTO v_missing_settings_count
    FROM public.workspaces ws
    WHERE NOT EXISTS (
        SELECT 1 FROM public.workspace_settings s
        WHERE s.workspace_id = ws.id
    );

    SELECT pg_catalog.count(*) INTO v_unprovisioned_user_count
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
       OR NOT EXISTS (
           SELECT 1 FROM public.workspace_members wm
           JOIN public.workspaces ws_active ON ws_active.id = wm.workspace_id
           WHERE wm.user_id = au.id
             AND wm.role = 'owner'
             AND ws_active.deleted_at IS NULL
       );

    IF v_orphan_ws_count > 0 OR v_missing_settings_count > 0 OR v_unprovisioned_user_count > 0 THEN
        RAISE EXCEPTION 'Backfill post-condition failed (orphan_workspaces=%, missing_settings=%, unprovisioned_users=%).',
            v_orphan_ws_count, v_missing_settings_count, v_unprovisioned_user_count;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 17. ROW LEVEL SECURITY (RLS) POLICIES
-- Direct DML on `workspace_members` has ZERO permissive policies (default-deny);
-- all membership mutations execute through the validated RPCs above.
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
DROP POLICY IF EXISTS "profiles_select_own_or_coworkers" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_admin" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_owner" ON public.workspaces;

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_admin" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_admin" ON public.workspace_members;

DROP POLICY IF EXISTS "workspace_settings_select_member" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_update_admin" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_insert_admin" ON public.workspace_settings;
END $$;

-- PROFILES POLICIES
CREATE POLICY "profiles_select_own_or_coworkers" ON public.profiles
    FOR SELECT
    USING (
        id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm1
            JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
            WHERE wm1.user_id = (SELECT auth.uid())
              AND wm2.user_id = public.profiles.id
        )
    );

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- WORKSPACES POLICIES
CREATE POLICY "workspaces_select_member" ON public.workspaces
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND (
            public.has_workspace_access(id, 'viewer')
            OR public.is_workspace_creator_during_insert(id, created_by)
        )
    );

CREATE POLICY "workspaces_insert_authenticated" ON public.workspaces
    FOR INSERT
    WITH CHECK (
        (SELECT auth.uid()) IS NOT NULL
        AND created_by IS NOT NULL
        AND deleted_at IS NULL
        AND (SELECT auth.uid()) = created_by
    );

CREATE POLICY "workspaces_update_admin" ON public.workspaces
    FOR UPDATE
    USING (deleted_at IS NULL AND public.has_workspace_access(id, 'admin'))
    WITH CHECK (deleted_at IS NULL AND public.has_workspace_access(id, 'admin'));

CREATE POLICY "workspaces_delete_owner" ON public.workspaces
    FOR DELETE
    USING (public.has_workspace_access(id, 'owner'));

-- WORKSPACE_MEMBERS POLICIES (SELECT ONLY — INSERT/UPDATE/DELETE default-deny via RLS & ACL)
CREATE POLICY "workspace_members_select" ON public.workspace_members
    FOR SELECT
    USING (
        public.has_workspace_access(workspace_id, 'viewer')
    );

-- WORKSPACE_SETTINGS POLICIES
CREATE POLICY "workspace_settings_select_member" ON public.workspace_settings
    FOR SELECT
    USING (public.has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "workspace_settings_update_admin" ON public.workspace_settings
    FOR UPDATE
    USING (public.has_workspace_access(workspace_id, 'admin'))
    WITH CHECK (public.has_workspace_access(workspace_id, 'admin'));

CREATE POLICY "workspace_settings_insert_admin" ON public.workspace_settings
    FOR INSERT
    WITH CHECK (public.has_workspace_access(workspace_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 18. GRANTS & PERMISSIONS HARDENING (Principle of Least Privilege)
-- ------------------------------------------------------------------------------
REVOKE ALL ON SCHEMA creatoros_internal FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA creatoros_internal FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA creatoros_internal FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creatoros_internal FROM PUBLIC, anon, authenticated, service_role;

-- Revoke object creation in `public` from non-owners while preserving PostgREST schema USAGE
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Strip all table, sequence, and function privileges from PUBLIC and anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

-- Harden default privileges for future objects created by `postgres` in `public` and `creatoros_internal`
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatoros_internal
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatoros_internal
    REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatoros_internal
    REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

-- Authenticated table privileges (`workspace_members` is strictly SELECT-only!)
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspaces TO authenticated;
GRANT SELECT ON TABLE public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.workspace_settings TO authenticated;

-- Service role table privileges (`workspace_members` is SELECT-only; mutations use validated RPCs)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspaces TO service_role;
GRANT SELECT ON TABLE public.workspace_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workspace_settings TO service_role;

-- Explicit EXECUTE grants ONLY on RLS helpers & client-callable validated RPCs
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_creator_during_insert(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_workspace_member(UUID, UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_workspace_member_role(UUID, UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_workspace_configuration(UUID, TEXT, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.soft_delete_workspace(UUID) TO authenticated, service_role;

COMMIT;
