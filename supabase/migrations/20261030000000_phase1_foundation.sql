-- ==============================================================================
-- MIGRATION: 20261030000000_phase1_foundation.sql
-- DESCRIPTION: Phase 1 Database Foundation (Hardened & Audited)
-- SECURITY: Mandatory Row Level Security (RLS), Safe Search Paths, Zero Self-Join Hole
-- IDEMPOTENT: Safe to run on fresh or existing databases with backfill
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
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
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
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 3. TABLE: workspace_members
-- Multi-tenant RBAC (isolated from client-side spoofing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
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
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. CHECK CONSTRAINTS (Idempotent Definition)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    -- profiles constraints
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_profiles_full_name') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT check_profiles_full_name 
            CHECK (char_length(trim(full_name)) >= 2);
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
            CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_workspaces_slug') THEN
        ALTER TABLE public.workspaces ADD CONSTRAINT check_workspaces_slug 
            CHECK (slug ~ '^[a-z0-9-]+$' AND char_length(slug) >= 3 AND char_length(slug) <= 60);
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
            CHECK (char_length(trim(default_ai_model)) > 0);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_settings_ws ON public.workspace_settings(workspace_id);

-- ------------------------------------------------------------------------------
-- 7. HELPER FUNCTION: has_workspace_access (Hardened SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_workspace_access(ws_id UUID, minimum_role VARCHAR DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    -- Reject unauthenticated callers immediately
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO user_role
    FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid();

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
-- 8. TRIGGER: Automatic Owner & Settings Creation on Workspace Insert
-- Ensures workspace creator atomically becomes owner without self-join vulnerability
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Atomically add the workspace creator as owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';

    -- 2. Atomically provision default settings
    INSERT INTO public.workspace_settings (workspace_id, default_language, default_ai_model)
    VALUES (NEW.id, 'id', 'gemini-1.5-flash')
    ON CONFLICT (workspace_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();

-- ------------------------------------------------------------------------------
-- 9. TRIGGER: Automatic Profile & Default Workspace on User Sign-Up
-- Robust error handling and transaction atomicity
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    new_user_name TEXT;
    base_slug TEXT;
    workspace_slug TEXT;
    v_counter INT := 1;
BEGIN
    -- Sanitize and extract display name
    new_user_name := COALESCE(
        NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(trim(split_part(NEW.email, '@', 1)), ''),
        'Creator'
    );

    -- Ensure minimum length constraint of 2 characters
    IF char_length(new_user_name) < 2 THEN
        new_user_name := 'Creator ' || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 4);
    END IF;

    -- Generate sanitized base slug
    base_slug := LOWER(REGEXP_REPLACE(new_user_name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := TRIM(BOTH '-' FROM base_slug);
    IF base_slug IS NULL OR char_length(base_slug) < 2 THEN
        base_slug := 'workspace';
    END IF;

    workspace_slug := base_slug || '-' || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6);

    -- Ensure defensive uniqueness
    WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = workspace_slug) LOOP
        workspace_slug := base_slug || '-' || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6) || '-' || v_counter;
        v_counter := v_counter + 1;
    END LOOP;

    -- 1. Create Profile
    INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference, onboarding_completed)
    VALUES (NEW.id, new_user_name, 'id', 'system', FALSE)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        updated_at = TIMEZONE('utc'::text, NOW());

    -- 2. Create Default Personal Workspace
    -- Note: on_workspace_created trigger will automatically add owner to workspace_members and create settings!
    INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
    VALUES (new_user_name || '''s Workspace', workspace_slug, 'creator', NEW.id);

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
-- 10. BACKFILL: Idempotent Migration for Existing auth.users
-- Provisions missing profiles and default workspaces for pre-existing accounts
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    u RECORD;
    v_user_name TEXT;
    v_base_slug TEXT;
    v_ws_slug TEXT;
    v_workspace_id UUID;
    v_counter INT;
BEGIN
    FOR u IN 
        SELECT id, email, raw_user_meta_data
        FROM auth.users
    LOOP
        -- 1. Backfill Profile if missing
        v_user_name := COALESCE(
            NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
            NULLIF(trim(split_part(u.email, '@', 1)), ''),
            'Creator'
        );

        IF char_length(v_user_name) < 2 THEN
            v_user_name := 'Creator ' || SUBSTRING(REPLACE(u.id::text, '-', '') FROM 1 FOR 4);
        END IF;

        INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference, onboarding_completed)
        VALUES (u.id, v_user_name, 'id', 'system', FALSE)
        ON CONFLICT (id) DO NOTHING;

        -- 2. Backfill Workspace if user has no workspace membership
        IF NOT EXISTS (
            SELECT 1 FROM public.workspace_members WHERE user_id = u.id
        ) THEN
            v_base_slug := LOWER(REGEXP_REPLACE(v_user_name, '[^a-zA-Z0-9]+', '-', 'g'));
            v_base_slug := TRIM(BOTH '-' FROM v_base_slug);
            IF v_base_slug IS NULL OR char_length(v_base_slug) < 2 THEN
                v_base_slug := 'workspace';
            END IF;

            v_ws_slug := v_base_slug || '-' || SUBSTRING(REPLACE(u.id::text, '-', '') FROM 1 FOR 6);
            v_counter := 1;

            WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = v_ws_slug) LOOP
                v_ws_slug := v_base_slug || '-' || SUBSTRING(REPLACE(u.id::text, '-', '') FROM 1 FOR 6) || '-' || v_counter;
                v_counter := v_counter + 1;
            END LOOP;

            -- Inserting into workspaces activates on_workspace_created trigger
            INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
            VALUES (v_user_name || '''s Workspace', v_ws_slug, 'creator', u.id)
            RETURNING id INTO v_workspace_id;

            -- Explicit defensive ensure for backfill
            INSERT INTO public.workspace_members (workspace_id, user_id, role)
            VALUES (v_workspace_id, u.id, 'owner')
            ON CONFLICT (workspace_id, user_id) DO NOTHING;

            INSERT INTO public.workspace_settings (workspace_id, default_language, default_ai_model)
            VALUES (v_workspace_id, 'id', 'gemini-1.5-flash')
            ON CONFLICT (workspace_id) DO NOTHING;
        END IF;
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
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

-- WORKSPACE_MEMBERS POLICIES (SECURITY HARDENED: Zero self-join hole)
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
-- 12. GRANTS & PERMISSIONS HARDENING
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
GRANT EXECUTE ON FUNCTION public.handle_new_workspace() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

COMMIT;
