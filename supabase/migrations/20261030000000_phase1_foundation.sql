-- ==============================================================================
-- MIGRATION: 20261030000000_phase1_foundation.sql
-- DESCRIPTION: Phase 1 Database Foundation (Final Hardened Edition)
-- SECURITY PROTOCOL:
--   - Mandatory Row Level Security (RLS) on all tenant tables
--   - SET search_path = '' on all SECURITY DEFINER functions (Zero hijacking)
--   - Fully qualified pg_catalog and public references
--   - Role escalation protection: Admin cannot promote to owner or demote/delete owner
--   - Last owner protection: Workspace cannot lose its last owner
--   - Dedicated atomic transfer_workspace_ownership function
--   - Independent idempotent backfill for profiles, workspaces, and settings
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
    created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
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
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
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
-- 5. CHECK CONSTRAINTS (Idempotent Definition)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- profiles constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_profiles_full_name') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_full_name 
            CHECK (pg_catalog.char_length(pg_catalog.trim(full_name)) >= 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_profiles_language') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_language 
            CHECK (preferred_language IN ('id', 'en'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_profiles_theme') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_theme 
            CHECK (theme_preference IN ('dark', 'light', 'system'));
    END IF;

    -- workspaces constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_workspaces_name') THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_name 
            CHECK (pg_catalog.char_length(pg_catalog.trim(name)) >= 2 AND pg_catalog.char_length(name) <= 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_workspaces_slug') THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_slug 
            CHECK (slug ~ '^[a-z0-9-]+$' AND pg_catalog.char_length(slug) >= 3 AND pg_catalog.char_length(slug) <= 60);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_workspaces_creator_mode') THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_creator_mode 
            CHECK (creator_mode IN ('creator', 'affiliate', 'business', 'personal_brand'));
    END IF;

    -- workspace_members constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_workspace_members_role') THEN
        ALTER TABLE public.workspace_members ADD CONSTRAINT check_workspace_members_role 
            CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member'));
    END IF;

    -- workspace_settings constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_workspace_settings_language') THEN
        ALTER TABLE public.workspace_settings ADD CONSTRAINT check_workspace_settings_language 
            CHECK (default_language IN ('id', 'en'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_workspace_settings_ai_model') THEN
        ALTER TABLE public.workspace_settings ADD CONSTRAINT check_workspace_settings_ai_model 
            CHECK (pg_catalog.char_length(pg_catalog.trim(default_ai_model)) > 0);
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
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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
-- 8. HELPER FUNCTION: has_workspace_access (Hardened SECURITY DEFINER)
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
    current_caller := auth.uid();
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
-- 9. TRIGGER: Enforce Role Escalation & Owner Protection Rules
-- Database-level defense: Admins cannot promote to owner, demote, or delete owners.
-- Workspace cannot lose its last owner.
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
BEGIN
    caller_id := auth.uid();

    -- Allow internal system triggers or service-role calls without auth context
    IF caller_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Fetch caller's current role in this workspace
    SELECT role INTO caller_role
    FROM public.workspace_members
    WHERE workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id)
      AND user_id = caller_id;

    -- 1. INSERTION ENFORCEMENT
    IF TG_OP = 'INSERT' THEN
        -- Only owner can add an owner
        IF NEW.role = 'owner' AND (caller_role IS NULL OR caller_role <> 'owner') THEN
            RAISE EXCEPTION 'Only an owner can grant the owner role';
        END IF;

        -- Members and viewers cannot insert other members
        IF caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Insufficient permissions to add workspace members';
        END IF;

        RETURN NEW;
    END IF;

    -- 2. UPDATE ENFORCEMENT
    IF TG_OP = 'UPDATE' THEN
        -- Check if target is an owner
        IF OLD.role = 'owner' THEN
            -- Only owner can modify an owner's record
            IF caller_role <> 'owner' THEN
                RAISE EXCEPTION 'Admins cannot modify the role of an owner';
            END IF;

            -- If demoting owner, ensure at least one other owner remains
            IF NEW.role <> 'owner' THEN
                SELECT pg_catalog.count(*) INTO owner_count
                FROM public.workspace_members
                WHERE workspace_id = OLD.workspace_id
                  AND role = 'owner';

                IF owner_count <= 1 THEN
                    RAISE EXCEPTION 'Cannot demote the last owner of the workspace';
                END IF;
            END IF;
        END IF;

        -- If promoting someone to owner, caller MUST be an owner
        IF OLD.role <> 'owner' AND NEW.role = 'owner' THEN
            IF caller_role <> 'owner' THEN
                RAISE EXCEPTION 'Only an owner can promote a member to owner';
            END IF;
        END IF;

        -- Non-admins/non-owners cannot update roles
        IF caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Insufficient permissions to update workspace members';
        END IF;

        RETURN NEW;
    END IF;

    -- 3. DELETION ENFORCEMENT
    IF TG_OP = 'DELETE' THEN
        -- If deleting an owner
        IF OLD.role = 'owner' THEN
            -- Check if it is the last owner
            SELECT pg_catalog.count(*) INTO owner_count
            FROM public.workspace_members
            WHERE workspace_id = OLD.workspace_id
              AND role = 'owner';

            IF owner_count <= 1 THEN
                RAISE EXCEPTION 'The last owner cannot leave or be removed. Transfer ownership or delete workspace.';
            END IF;

            -- Admins cannot delete an owner
            IF caller_role <> 'owner' AND caller_id <> OLD.user_id THEN
                RAISE EXCEPTION 'Admins cannot remove a workspace owner';
            END IF;
        END IF;

        -- Members can only delete themselves (leave), admins/owners can remove others
        IF caller_id <> OLD.user_id AND caller_role NOT IN ('owner', 'admin') THEN
            RAISE EXCEPTION 'Insufficient permissions to remove this member';
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
-- Secure procedure for transferring workspace ownership safely
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
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- 1. Verify caller is currently an owner of the target workspace
    SELECT role INTO caller_role
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = caller_id;

    IF caller_role IS NULL OR caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Only an owner can transfer workspace ownership';
    END IF;

    -- No-op if transferring to self
    IF caller_id = new_owner_user_id THEN
        RETURN TRUE;
    END IF;

    -- 2. Verify target user is already a member of this workspace
    SELECT role INTO target_role
    FROM public.workspace_members
    WHERE workspace_id = target_workspace_id
      AND user_id = new_owner_user_id;

    IF target_role IS NULL THEN
        RAISE EXCEPTION 'Target user must already be a member of the workspace before receiving ownership';
    END IF;

    -- 3. Execute atomic transfer
    -- Promote recipient to owner
    UPDATE public.workspace_members
    SET role = 'owner', updated_at = pg_catalog.now()
    WHERE workspace_id = target_workspace_id
      AND user_id = new_owner_user_id;

    -- Demote former owner to admin
    UPDATE public.workspace_members
    SET role = 'admin', updated_at = pg_catalog.now()
    WHERE workspace_id = target_workspace_id
      AND user_id = caller_id;

    -- Update workspace timestamp
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
    v_counter INT := 1;
BEGIN
    -- Sanitize and extract display name
    new_user_name := COALESCE(
        NULLIF(pg_catalog.trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(pg_catalog.trim(pg_catalog.split_part(NEW.email, '@', 1)), ''),
        'Creator'
    );

    IF pg_catalog.char_length(new_user_name) < 2 THEN
        new_user_name := 'Creator ' || pg_catalog.substring(pg_catalog.replace(NEW.id::text, '-', '') FROM 1 FOR 4);
    END IF;

    -- Generate sanitized base slug
    base_slug := pg_catalog.lower(pg_catalog.regexp_replace(new_user_name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := pg_catalog.trim(BOTH '-' FROM base_slug);
    IF base_slug IS NULL OR pg_catalog.char_length(base_slug) < 2 THEN
        base_slug := 'workspace';
    END IF;

    workspace_slug := base_slug || '-' || pg_catalog.substring(pg_catalog.replace(NEW.id::text, '-', '') FROM 1 FOR 6);

    -- Ensure defensive uniqueness
    WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = workspace_slug) LOOP
        workspace_slug := base_slug || '-' || pg_catalog.substring(pg_catalog.replace(NEW.id::text, '-', '') FROM 1 FOR 6) || '-' || v_counter;
        v_counter := v_counter + 1;
    END LOOP;

    -- 1. Create Profile (Never overwrite an edited profile)
    INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference, onboarding_completed, created_at, updated_at)
    VALUES (NEW.id, new_user_name, 'id', 'system', FALSE, pg_catalog.now(), pg_catalog.now())
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create Default Personal Workspace
    -- on_workspace_created trigger will auto-add owner member and settings
    INSERT INTO public.workspaces (name, slug, creator_mode, created_by, created_at, updated_at)
    VALUES (new_user_name || '''s Workspace', workspace_slug, 'creator', NEW.id, pg_catalog.now(), pg_catalog.now());

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RAISE;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 13. BACKFILL: Independent & Idempotent Migration for Existing auth.users
-- Independently validates profiles, workspaces, and workspace_settings
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    u RECORD;
    w RECORD;
    v_user_name TEXT;
    v_base_slug TEXT;
    v_ws_slug TEXT;
    v_workspace_id UUID;
    v_counter INT;
BEGIN
    -- 1. INDEPENDENT BACKFILL: Profiles
    -- If profile already exists, NEVER overwrite full_name or preferences!
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

            IF pg_catalog.char_length(v_user_name) < 2 THEN
                v_user_name := 'Creator ' || pg_catalog.substring(pg_catalog.replace(u.id::text, '-', '') FROM 1 FOR 4);
            END IF;

            INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference, onboarding_completed, created_at, updated_at)
            VALUES (u.id, v_user_name, 'id', 'system', FALSE, pg_catalog.now(), pg_catalog.now());
        END IF;
    END LOOP;

    -- 2. INDEPENDENT BACKFILL: Workspaces & Memberships
    -- Only create if user has zero workspace memberships
    FOR u IN 
        SELECT id, email, raw_user_meta_data
        FROM auth.users
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = u.id) THEN
            SELECT full_name INTO v_user_name FROM public.profiles WHERE id = u.id;
            IF v_user_name IS NULL OR pg_catalog.char_length(v_user_name) < 2 THEN
                v_user_name := 'Creator';
            END IF;

            v_base_slug := pg_catalog.lower(pg_catalog.regexp_replace(v_user_name, '[^a-zA-Z0-9]+', '-', 'g'));
            v_base_slug := pg_catalog.trim(BOTH '-' FROM v_base_slug);
            IF v_base_slug IS NULL OR pg_catalog.char_length(v_base_slug) < 2 THEN
                v_base_slug := 'workspace';
            END IF;

            v_ws_slug := v_base_slug || '-' || pg_catalog.substring(pg_catalog.replace(u.id::text, '-', '') FROM 1 FOR 6);
            v_counter := 1;

            WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_ws_slug) LOOP
                v_ws_slug := v_base_slug || '-' || pg_catalog.substring(pg_catalog.replace(u.id::text, '-', '') FROM 1 FOR 6) || '-' || v_counter;
                v_counter := v_counter + 1;
            END LOOP;

            INSERT INTO public.workspaces (name, slug, creator_mode, created_by, created_at, updated_at)
            VALUES (v_user_name || '''s Workspace', v_ws_slug, 'creator', u.id, pg_catalog.now(), pg_catalog.now())
            RETURNING id INTO v_workspace_id;

            -- Explicit backup ensures membership & settings
            INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at, updated_at)
            VALUES (v_workspace_id, u.id, 'owner', pg_catalog.now(), pg_catalog.now())
            ON CONFLICT (workspace_id, user_id) DO NOTHING;

            INSERT INTO public.workspace_settings (workspace_id, default_language, default_ai_model, created_at, updated_at)
            VALUES (v_workspace_id, 'id', 'gemini-1.5-flash', pg_catalog.now(), pg_catalog.now())
            ON CONFLICT (workspace_id) DO NOTHING;
        END IF;
    END LOOP;

    -- 3. INDEPENDENT BACKFILL: Workspace Settings
    -- If a workspace exists without settings, provision settings without duplicating workspace
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
-- Strict least-privilege, no self-join backdoor
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
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.workspace_members wm1
            JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
            WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
        )
    );

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- WORKSPACES POLICIES
CREATE POLICY "workspaces_select_member" ON public.workspaces
    FOR SELECT
    USING (
        public.has_workspace_access(id, 'viewer')
    );

CREATE POLICY "workspaces_insert_authenticated" ON public.workspaces
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND auth.uid() = created_by
    );

CREATE POLICY "workspaces_update_admin" ON public.workspaces
    FOR UPDATE
    USING (public.has_workspace_access(id, 'admin'))
    WITH CHECK (public.has_workspace_access(id, 'admin'));

CREATE POLICY "workspaces_delete_owner" ON public.workspaces
    FOR DELETE
    USING (public.has_workspace_access(id, 'owner'));

-- WORKSPACE_MEMBERS POLICIES
CREATE POLICY "workspace_members_select" ON public.workspace_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR public.has_workspace_access(workspace_id, 'viewer')
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
        user_id = auth.uid() OR public.has_workspace_access(workspace_id, 'admin')
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
-- 15. GRANTS & PERMISSIONS HARDENING
-- Principle of Least Privilege: Zero public or anon data leakage
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Revoke all table access by default from public and anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;

-- Grant table operations to authenticated users (governed strictly by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant service_role full administrative access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Secure function execution
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_workspace_ownership(UUID, UUID) TO authenticated, service_role;

-- Triggers do not need direct execute by client roles
REVOKE ALL ON FUNCTION public.handle_new_workspace() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_workspace() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_workspace_member_safety() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_workspace_member_safety() TO service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

COMMIT;
