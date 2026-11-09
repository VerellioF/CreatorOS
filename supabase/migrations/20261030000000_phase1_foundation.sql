-- ==============================================================================
-- MIGRATION: 20261030000000_phase1_foundation.sql
-- PRODUCT: CreatorOS AI (Phase 1 Database Foundation)
-- ARCHITECTURE: Modular Monolith, Multi-tenant Isolation, Strict Least Privilege
-- ==============================================================================
-- COMPREHENSIVE SECURITY HARDENING AUDIT COMPLIANCE:
-- 1. Anti-Null Privilege Gaps: Explicit IS NULL / IS NOT NULL checks across all role validations.
-- 2. Membership Identity Immutability: workspace_id and user_id are strictly immutable on UPDATE.
-- 3. Strict Role Hierarchy:
--    - Only owner can grant or revoke the admin role.
--    - Admin can only manage editor, viewer, and member roles.
--    - Admin cannot promote to admin or owner, nor modify, demote, or delete an owner or another admin.
--    - Only owner can initiate ownership transfer.
-- 4. Concurrency Protection & Anti-Deadlock:
--    - Critical operations lock parent workspace row (SELECT ... FOR UPDATE) to serialize checks.
--    - Membership locks are ordered deterministically by id ASC to eliminate deadlocks.
--    - Guaranteed protection against concurrent last-owner deletion, demotion, or orphaned workspaces.
-- 5. Safe Atomic Ownership Transfer:
--    - transfer_workspace_ownership() executes atomic owner promotion and former-owner demotion.
--    - Direct UPDATE to role = 'owner' or demoting an owner is blocked unless inside transfer function.
-- 6. Independent & Idempotent Backfill:
--    - Repairs orphaned workspaces (valid created_by without owner membership) in place.
--    - Provisions missing profiles without overwriting existing names or preferences.
--    - Provisions default workspaces and settings only where missing.
-- 7. High-Integrity Data Validation:
--    - Sanitized and length-bounded full_name (<=100), workspace name (<=100), and slug (<=80).
--    - Collision-resistant slug generation utilizing UUID entropy.
--    - pg_constraint checks bounded strictly by conrelid.
--    - Removed SECURITY DEFINER from set_updated_at().
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- ------------------------------------------------------------------------------
-- 2. TABLE: workspaces
-- Core multi-tenant boundary
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    creator_mode VARCHAR(30) DEFAULT 'creator' NOT NULL,
    logo_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 3. TABLE: workspace_members
-- Multi-tenant RBAC
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    UNIQUE(workspace_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 4. TABLE: workspace_settings
-- Workspace-specific preferences and configuration
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    default_language VARCHAR(10) DEFAULT 'id' NOT NULL,
    default_ai_model VARCHAR(50) DEFAULT 'gemini-1.5-flash' NOT NULL,
    enable_auto_hashtag BOOLEAN DEFAULT TRUE NOT NULL,
    notify_on_publish BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. CHECK CONSTRAINTS (Bounded by conrelid for Strict Schema Isolation)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- profiles constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_profiles_full_name' 
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_full_name 
            CHECK (pg_catalog.char_length(pg_catalog.trim(full_name)) >= 2 AND pg_catalog.char_length(full_name) <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_profiles_language' 
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_language 
            CHECK (preferred_language IN ('id', 'en'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_profiles_theme' 
          AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_theme 
            CHECK (theme_preference IN ('dark', 'light', 'system'));
    END IF;

    -- workspaces constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_workspaces_name' 
          AND conrelid = 'public.workspaces'::regclass
    ) THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_name 
            CHECK (pg_catalog.char_length(pg_catalog.trim(name)) >= 2 AND pg_catalog.char_length(name) <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_workspaces_slug' 
          AND conrelid = 'public.workspaces'::regclass
    ) THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_slug 
            CHECK (slug ~ '^[a-z0-9-]+$' AND pg_catalog.char_length(slug) >= 2 AND pg_catalog.char_length(slug) <= 80);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_workspaces_creator_mode' 
          AND conrelid = 'public.workspaces'::regclass
    ) THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_creator_mode 
            CHECK (creator_mode IN ('creator', 'affiliate', 'business', 'personal_brand'));
    END IF;

    -- workspace_members constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_workspace_members_role' 
          AND conrelid = 'public.workspace_members'::regclass
    ) THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT check_workspace_members_role 
            CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member'));
    END IF;

    -- workspace_settings constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_workspace_settings_language' 
          AND conrelid = 'public.workspace_settings'::regclass
    ) THEN
        ALTER TABLE public.workspace_settings ADD CONSTRAINT check_workspace_settings_language 
            CHECK (default_language IN ('id', 'en'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint 
        WHERE conname = 'check_workspace_settings_ai_model' 
          AND conrelid = 'public.workspace_settings'::regclass
    ) THEN
        ALTER TABLE public.workspace_settings ADD CONSTRAINT check_workspace_settings_ai_model 
            CHECK (pg_catalog.char_length(pg_catalog.trim(default_ai_model)) > 0 AND pg_catalog.char_length(default_ai_model) <= 100);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON public.workspace_members(workspace_id, role);
CREATE INDEX IF NOT EXISTS idx_workspace_settings_ws ON public.workspace_settings(workspace_id);

-- ------------------------------------------------------------------------------
-- 7. TRIGGER: Auto-update updated_at Timestamp
-- NOTE: Standard caller context function, SECURITY DEFINER is intentionally omitted.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trigger_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER trigger_workspace_members_updated_at
    BEFORE UPDATE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_workspace_settings_updated_at ON public.workspace_settings;
CREATE TRIGGER trigger_workspace_settings_updated_at
    BEFORE UPDATE ON public.workspace_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 8. HELPER FUNCTION: has_workspace_access (SECURITY DEFINER with empty search_path)
-- Prevents recursive RLS evaluation when checking membership permissions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_workspace_access(ws_id UUID, minimum_role VARCHAR DEFAULT 'viewer')
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
    current_caller := (SELECT auth.uid());
    IF current_caller IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT wm.role INTO user_role
    FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = current_caller;

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    IF minimum_role = 'viewer' THEN
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

-- ------------------------------------------------------------------------------
-- 9. TRIGGER: Enforce Role Escalation, Owner Protection & Concurrency Rules
-- Enforces:
--  - Identity immutability: workspace_id and user_id cannot be changed.
--  - Explicit NULL handling: Unauthenticated callers and non-members are rejected.
--  - Concurrency safety: Row locking on workspaces prevents race conditions.
--  - Hierarchy: Only owner can grant/revoke admin. Admin cannot touch owners or admins.
--  - Last owner protection: Last remaining owner cannot leave, be demoted, or be deleted.
--  - Direct transfer lock: Direct UPDATE to role = 'owner' is blocked outside transfer function.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_workspace_member_safety()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    caller_id UUID;
    caller_role VARCHAR;
    owner_count INT;
    target_workspace_id UUID;
BEGIN
    caller_id := (SELECT auth.uid());

    -- Distinguish between unauthenticated users and internal system operations
    IF caller_id IS NULL THEN
        IF pg_catalog.current_setting('creatoros.internal_operation', true) = 'true'
           OR pg_catalog.current_user IN ('postgres', 'supabase_admin') THEN
            RETURN COALESCE(NEW, OLD);
        END IF;
        RAISE EXCEPTION 'Unauthorized: Unauthenticated operations on workspace members are strictly forbidden.';
    END IF;

    target_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);

    -- Fetch caller's verified role in this workspace
    SELECT role INTO caller_role
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = caller_id;

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller is not a member of this workspace.';
    END IF;

    -- =========================================================================
    -- 1. INSERTION ENFORCEMENT
    -- =========================================================================
    IF TG_OP = 'INSERT' THEN
        -- Only owner can grant the owner role
        IF NEW.role = 'owner' AND caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Role escalation rejected: Only workspace owners can assign the owner role.';
        END IF;

        -- Only owner can grant the admin role
        IF NEW.role = 'admin' AND caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Role escalation rejected: Only workspace owners can assign the admin role.';
        END IF;

        -- Admins can only assign editor, viewer, or member roles
        IF caller_role = 'admin' AND NEW.role NOT IN ('editor', 'viewer', 'member') THEN
            RAISE EXCEPTION 'Privilege violation: Admins can only add editor, viewer, or member roles.';
        END IF;

        -- Viewers, editors, and members cannot add members
        IF caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to add workspace members.';
        END IF;

        RETURN NEW;
    END IF;

    -- =========================================================================
    -- 2. UPDATE ENFORCEMENT
    -- =========================================================================
    IF TG_OP = 'UPDATE' THEN
        -- Identity Immutability: workspace_id and user_id must NEVER change
        IF NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id THEN
            RAISE EXCEPTION 'Data integrity violation: Membership identity (workspace_id, user_id) is immutable.';
        END IF;

        -- Direct owner promotion or demotion is blocked outside transfer_workspace_ownership()
        IF (OLD.role = 'owner' OR NEW.role = 'owner') AND OLD.role <> NEW.role THEN
            IF pg_catalog.current_setting('creatoros.ownership_transfer_active', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Direct owner role modifications are prohibited. Use transfer_workspace_ownership() instead.';
            END IF;
        END IF;

        -- Only owner can grant, modify, or revoke the admin role
        IF (NEW.role = 'admin' OR OLD.role = 'admin') AND OLD.role <> NEW.role AND caller_role <> 'owner' THEN
            RAISE EXCEPTION 'Role escalation rejected: Only workspace owners can grant or revoke the admin role.';
        END IF;

        -- Admin cannot touch an owner or another admin
        IF caller_role = 'admin' AND OLD.role IN ('owner', 'admin') AND OLD.user_id <> caller_id THEN
            RAISE EXCEPTION 'Privilege violation: Admins cannot modify owners or other admins.';
        END IF;

        -- Admins can only change members between editor, viewer, and member
        IF caller_role = 'admin' AND NEW.role NOT IN ('editor', 'viewer', 'member') THEN
            RAISE EXCEPTION 'Privilege violation: Admins can only assign editor, viewer, or member roles.';
        END IF;

        -- Non-admins/non-owners cannot update roles
        IF caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to update workspace members.';
        END IF;

        -- Concurrency & Last Owner Demotion Protection
        IF OLD.role = 'owner' AND NEW.role <> 'owner' THEN
            -- Acquire workspace row lock to serialize concurrent demotions
            PERFORM 1 FROM public.workspaces WHERE id = OLD.workspace_id FOR UPDATE;

            SELECT pg_catalog.count(*) INTO owner_count
            FROM public.workspace_members
            WHERE workspace_id = OLD.workspace_id
              AND role = 'owner';

            IF owner_count <= 1 THEN
                RAISE EXCEPTION 'Owner protection violation: The last remaining owner cannot be demoted. Transfer ownership first.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- =========================================================================
    -- 3. DELETION ENFORCEMENT
    -- =========================================================================
    IF TG_OP = 'DELETE' THEN
        -- If workspace itself is being deleted, cascade removal is allowed
        IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
            RETURN OLD;
        END IF;

        -- Admin cannot remove an owner or another admin
        IF caller_role = 'admin' AND OLD.role IN ('owner', 'admin') AND OLD.user_id <> caller_id THEN
            RAISE EXCEPTION 'Privilege violation: Admins cannot remove owners or other admins.';
        END IF;

        -- Non-admins/non-owners can only remove themselves (leave workspace)
        IF caller_role NOT IN ('owner', 'admin') AND caller_id <> OLD.user_id THEN
            RAISE EXCEPTION 'Unauthorized: Insufficient permissions to remove this workspace member.';
        END IF;

        -- Last Owner Removal Protection
        IF OLD.role = 'owner' THEN
            -- Lock workspace row first to serialize concurrent owner deletions
            PERFORM 1 FROM public.workspaces WHERE id = OLD.workspace_id FOR UPDATE;

            SELECT pg_catalog.count(*) INTO owner_count
            FROM public.workspace_members
            WHERE workspace_id = OLD.workspace_id
              AND role = 'owner';

            IF owner_count <= 1 THEN
                RAISE EXCEPTION 'Owner protection violation: The last remaining owner cannot leave or be removed. Transfer ownership or delete the workspace.';
            END IF;
        END IF;

        RETURN OLD;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_workspace_member_safety ON public.workspace_members;
CREATE TRIGGER trigger_workspace_member_safety
    BEFORE INSERT OR UPDATE OR DELETE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_member_safety();

-- ------------------------------------------------------------------------------
-- 10. ATOMIC OWNERSHIP TRANSFER FUNCTION
-- Secure, serialized, deadlock-free procedure for transferring workspace ownership
-- ------------------------------------------------------------------------------
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
    caller_id UUID;
    caller_role VARCHAR;
    target_role VARCHAR;
BEGIN
    caller_id := (SELECT auth.uid());
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF new_owner_user_id IS NULL THEN
        RAISE EXCEPTION 'Invalid target: New owner user id cannot be NULL.';
    END IF;

    -- 1. Concurrency Control: Lock parent workspace row first (Serialization Point)
    PERFORM 1 FROM public.workspaces 
    WHERE id = target_workspace_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found: %', target_workspace_id;
    END IF;

    -- 2. Verify caller is currently an owner of the target workspace
    SELECT role INTO caller_role
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = caller_id;

    IF caller_role IS NULL OR caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Unauthorized: Only a workspace owner can transfer ownership.';
    END IF;

    -- No-op if transferring to self
    IF caller_id = new_owner_user_id THEN
        RETURN TRUE;
    END IF;

    -- 3. Deadlock-free member locking (Deterministic Ordering by id ASC)
    PERFORM 1 FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id IN (caller_id, new_owner_user_id)
    ORDER BY id ASC
    FOR UPDATE;

    -- 4. Verify recipient is an existing member of the workspace
    SELECT role INTO target_role
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = new_owner_user_id;

    IF target_role IS NULL THEN
        RAISE EXCEPTION 'Invalid target: Target user must already be a member of the workspace before receiving ownership.';
    END IF;

    -- 5. Enable transaction-local bypass flag so trigger allows the atomic swap
    PERFORM pg_catalog.set_config('creatoros.ownership_transfer_active', 'true', true);

    -- 6. Execute atomic transfer: promote recipient to owner, demote former owner to admin
    UPDATE public.workspace_members
    SET role = 'owner', updated_at = pg_catalog.now()
    WHERE workspace_id = target_workspace_id
      AND user_id = new_owner_user_id;

    UPDATE public.workspace_members
    SET role = 'admin', updated_at = pg_catalog.now()
    WHERE workspace_id = target_workspace_id
      AND user_id = caller_id;

    -- Update parent workspace timestamp
    UPDATE public.workspaces
    SET updated_at = pg_catalog.now()
    WHERE id = target_workspace_id;

    RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. TRIGGER: Automatic Owner & Settings Creation on Workspace Insert
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Set transaction-local internal operation flag to allow trigger provisioning
    PERFORM pg_catalog.set_config('creatoros.internal_operation', 'true', true);

    -- 1. Atomically add the workspace creator as owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
    VALUES (NEW.id, NEW.created_by, 'owner', pg_catalog.now(), pg_catalog.now())
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';

    -- 2. Atomically provision default settings
    INSERT INTO public.workspace_settings (workspace_id, default_language, default_ai_model, created_at, updated_at)
    VALUES (NEW.id, 'id', 'gemini-1.5-flash', pg_catalog.now(), pg_catalog.now())
    ON CONFLICT (workspace_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ------------------------------------------------------------------------------
-- 12. TRIGGER: Automatic Profile & Default Workspace on User Sign-Up
-- Robust against long metadata, invalid characters, and slug collision
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_user_name TEXT;
    base_slug TEXT;
    workspace_slug TEXT;
    workspace_name TEXT;
    v_random_suffix TEXT;
    v_counter INT := 1;
BEGIN
    -- Set transaction-local internal operation flag
    PERFORM pg_catalog.set_config('creatoros.internal_operation', 'true', true);

    -- Sanitize, extract, and truncate display name (max 100 chars, min 2)
    new_user_name := COALESCE(
        NULLIF(pg_catalog.trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(pg_catalog.trim(pg_catalog.split_part(NEW.email, '@', 1)), ''),
        'Creator'
    );
    new_user_name := pg_catalog.substring(new_user_name FROM 1 FOR 90);

    IF pg_catalog.char_length(new_user_name) < 2 THEN
        new_user_name := 'Creator ' || pg_catalog.substring(pg_catalog.replace(NEW.id::text, '-', '') FROM 1 FOR 4);
    END IF;

    -- Sanitize base slug
    base_slug := pg_catalog.lower(pg_catalog.regexp_replace(new_user_name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := pg_catalog.trim(BOTH '-' FROM base_slug);
    base_slug := pg_catalog.substring(base_slug FROM 1 FOR 40);

    IF base_slug IS NULL OR pg_catalog.char_length(base_slug) < 2 THEN
        base_slug := 'workspace';
    END IF;

    -- Entropy-backed initial slug (UUID fragment ensures near-zero collision during concurrent signups)
    v_random_suffix := pg_catalog.substring(pg_catalog.replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6);
    workspace_slug := base_slug || '-' || v_random_suffix;

    -- Collision loop fallback
    WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = workspace_slug) AND v_counter <= 100 LOOP
        workspace_slug := base_slug || '-' || v_random_suffix || '-' || v_counter;
        v_counter := v_counter + 1;
    END LOOP;

    workspace_name := pg_catalog.substring(new_user_name || '''s Workspace' FROM 1 FOR 100);

    -- 1. Create Profile (Never overwrite existing user profile)
    INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference, onboarding_completed, created_at, updated_at)
    VALUES (NEW.id, new_user_name, 'id', 'system', FALSE, pg_catalog.now(), pg_catalog.now())
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create Default Workspace
    -- on_workspace_created trigger will auto-provision owner member and settings
    INSERT INTO public.workspaces (name, slug, creator_mode, created_by, created_at, updated_at)
    VALUES (workspace_name, workspace_slug, 'creator', NEW.id, pg_catalog.now(), pg_catalog.now())
    ON CONFLICT (slug) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed safely for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 13. BACKFILL: Independent, Idempotent, and Orphan-Repairing
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    u RECORD;
    w RECORD;
    v_user_name TEXT;
    v_base_slug TEXT;
    v_ws_slug TEXT;
    v_ws_name TEXT;
    v_workspace_id UUID;
    v_random_suffix TEXT;
    v_counter INT;
BEGIN
    -- Set transaction-local internal operation flag
    PERFORM pg_catalog.set_config('creatoros.internal_operation', 'true', true);

    -- 1. INDEPENDENT BACKFILL: Profiles for all existing auth.users
    -- Never overwrites edited user profile names or preferences
    FOR u IN 
        SELECT id, email, raw_user_meta_data
        FROM auth.users
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id) THEN
            v_user_name := COALESCE(
                NULLIF(pg_catalog.trim(u.raw_user_meta_data->>'full_name'), ''),
                NULLIF(pg_catalog.trim(pg_catalog.split_part(u.email, '@', 1)), ''),
                'Creator'
            );
            v_user_name := pg_catalog.substring(v_user_name FROM 1 FOR 90);

            IF pg_catalog.char_length(v_user_name) < 2 THEN
                v_user_name := 'Creator ' || pg_catalog.substring(pg_catalog.replace(u.id::text, '-', '') FROM 1 FOR 4);
            END IF;

            INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference, onboarding_completed, created_at, updated_at)
            VALUES (u.id, v_user_name, 'id', 'system', FALSE, pg_catalog.now(), pg_catalog.now())
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END LOOP;

    -- 2. INDEPENDENT BACKFILL: Repair Orphaned Workspaces
    -- If a workspace has a valid created_by but lacks an owner membership, repair it in-place!
    FOR w IN
        SELECT id, created_by 
        FROM public.workspaces
        WHERE NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = public.workspaces.id AND wm.role = 'owner'
        )
    LOOP
        INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
        VALUES (w.id, w.created_by, 'owner', pg_catalog.now(), pg_catalog.now())
        ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
    END LOOP;

    -- 3. INDEPENDENT BACKFILL: Default Workspace for users who have NO membership anywhere
    FOR u IN 
        SELECT id, email, raw_user_meta_data
        FROM auth.users
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = u.id) THEN
            SELECT full_name INTO v_user_name FROM public.profiles WHERE id = u.id;
            IF v_user_name IS NULL OR pg_catalog.char_length(v_user_name) < 2 THEN
                v_user_name := 'Creator';
            END IF;
            v_user_name := pg_catalog.substring(v_user_name FROM 1 FOR 90);

            v_base_slug := pg_catalog.lower(pg_catalog.regexp_replace(v_user_name, '[^a-zA-Z0-9]+', '-', 'g'));
            v_base_slug := pg_catalog.trim(BOTH '-' FROM v_base_slug);
            v_base_slug := pg_catalog.substring(v_base_slug FROM 1 FOR 40);

            IF v_base_slug IS NULL OR pg_catalog.char_length(v_base_slug) < 2 THEN
                v_base_slug := 'workspace';
            END IF;

            v_random_suffix := pg_catalog.substring(pg_catalog.replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 6);
            v_ws_slug := v_base_slug || '-' || v_random_suffix;
            v_counter := 1;

            WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_ws_slug) AND v_counter <= 100 LOOP
                v_ws_slug := v_base_slug || '-' || v_random_suffix || '-' || v_counter;
                v_counter := v_counter + 1;
            END LOOP;

            v_ws_name := pg_catalog.substring(v_user_name || '''s Workspace' FROM 1 FOR 100);

            INSERT INTO public.workspaces (name, slug, creator_mode, created_by, created_at, updated_at)
            VALUES (v_ws_name, v_ws_slug, 'creator', u.id, pg_catalog.now(), pg_catalog.now())
            RETURNING id INTO v_workspace_id;

            -- Explicit membership and settings (on_workspace_created also ensures this)
            INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
            VALUES (v_workspace_id, u.id, 'owner', pg_catalog.now(), pg_catalog.now())
            ON CONFLICT (workspace_id, user_id) DO NOTHING;

            INSERT INTO public.workspace_settings (workspace_id, default_language, default_ai_model, created_at, updated_at)
            VALUES (v_workspace_id, 'id', 'gemini-1.5-flash', pg_catalog.now(), pg_catalog.now())
            ON CONFLICT (workspace_id) DO NOTHING;
        END IF;
    END LOOP;

    -- 4. INDEPENDENT BACKFILL: Workspace Settings for any workspace lacking them
    FOR w IN 
        SELECT id FROM public.workspaces
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.workspace_settings WHERE workspace_id = w.id) THEN
            INSERT INTO public.workspace_settings (workspace_id, default_language, default_ai_model, created_at, updated_at)
            VALUES (w.id, 'id', 'gemini-1.5-flash', pg_catalog.now(), pg_catalog.now())
            ON CONFLICT (workspace_id) DO NOTHING;
        END IF;
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict least-privilege, zero self-join backdoor
-- ------------------------------------------------------------------------------

-- Enable RLS on all 4 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

-- Clean existing policies for idempotency
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

-- PROFILES POLICIES
CREATE POLICY "profiles_select_own_or_coworkers" ON public.profiles
    FOR SELECT
    USING (
        id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm1
            JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
            WHERE wm1.user_id = (SELECT auth.uid()) AND wm2.user_id = profiles.id
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
        public.has_workspace_access(id, 'viewer')
    );

CREATE POLICY "workspaces_insert_authenticated" ON public.workspaces
    FOR INSERT
    WITH CHECK (
        (SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = created_by
    );

CREATE POLICY "workspaces_update_admin" ON public.workspaces
    FOR UPDATE
    USING (public.has_workspace_access(id, 'admin'))
    WITH CHECK (public.has_workspace_access(id, 'admin'));

CREATE POLICY "workspaces_delete_owner" ON public.workspaces
    FOR DELETE
    USING (public.has_workspace_access(id, 'owner'));

-- WORKSPACE_MEMBERS POLICIES
-- NOTE: Absolutely NO "OR user_id = auth.uid()" in INSERT to prevent self-join backdoors!
CREATE POLICY "workspace_members_select" ON public.workspace_members
    FOR SELECT
    USING (
        user_id = (SELECT auth.uid()) OR public.has_workspace_access(workspace_id, 'viewer')
    );

CREATE POLICY "workspace_members_insert_admin" ON public.workspace_members
    FOR INSERT
    WITH CHECK (
        public.has_workspace_access(workspace_id, 'admin')
    );

CREATE POLICY "workspace_members_update_admin" ON public.workspace_members
    FOR UPDATE
    USING (public.has_workspace_access(workspace_id, 'admin'))
    WITH CHECK (public.has_workspace_access(workspace_id, 'admin'));

CREATE POLICY "workspace_members_delete_admin" ON public.workspace_members
    FOR DELETE
    USING (
        user_id = (SELECT auth.uid()) OR public.has_workspace_access(workspace_id, 'admin')
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
-- 15. GRANTS & PERMISSIONS AUDIT & HARDENING
-- Principle of Least Privilege: Zero public or anon data leakage
-- ------------------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

-- Grant table operations to authenticated users (governed strictly by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant service_role full administrative access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Secure function execution
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership(UUID, UUID) TO authenticated, service_role;

-- Triggers are invoked internally by Postgres and service_role
GRANT EXECUTE ON FUNCTION public.handle_new_workspace() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_workspace_member_safety() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

COMMIT;
