-- ==============================================================================
-- MIGRATION: 20261030000000_phase1_foundation.sql
-- DESCRIPTION: Phase 1 Database Foundation (Profiles, Workspaces, Members, Settings)
-- SECURITY: Mandatory Row Level Security (RLS) on all tables
-- ==============================================================================

-- Enable UUID extension if not enabled
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
    preferred_language VARCHAR(10) DEFAULT 'id' NOT NULL, -- 'id' | 'en'
    theme_preference VARCHAR(10) DEFAULT 'system' NOT NULL, -- 'dark' | 'light' | 'system'
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
    creator_mode VARCHAR(30) DEFAULT 'creator' NOT NULL, -- 'creator' | 'affiliate' | 'business' | 'personal_brand'
    logo_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
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
    role VARCHAR(20) DEFAULT 'member' NOT NULL, -- 'owner' | 'admin' | 'editor' | 'viewer'
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
-- INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_settings_ws ON public.workspace_settings(workspace_id);

-- ------------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR RLS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_workspace_access(ws_id UUID, minimum_role VARCHAR DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    user_role VARCHAR;
BEGIN
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on all 4 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

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
    WITH CHECK (auth.uid() = created_by);

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
        public.has_workspace_access(workspace_id, 'admin') OR user_id = auth.uid()
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
-- AUTOMATIC USER & DEFAULT WORKSPACE TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_user_name TEXT;
    workspace_id_new UUID;
    workspace_slug TEXT;
BEGIN
    new_user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    workspace_slug := LOWER(REGEXP_REPLACE(new_user_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTRING(NEW.id::text FROM 1 FOR 6);

    -- 1. Create Profile
    INSERT INTO public.profiles (id, full_name, preferred_language, theme_preference, onboarding_completed)
    VALUES (NEW.id, new_user_name, 'id', 'system', FALSE)
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create Default Personal Workspace
    INSERT INTO public.workspaces (name, slug, creator_mode, created_by)
    VALUES (new_user_name || '''s Workspace', workspace_slug, 'creator', NEW.id)
    RETURNING id INTO workspace_id_new;

    -- 3. Add Member as Owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (workspace_id_new, NEW.id, 'owner');

    -- 4. Create Default Workspace Settings
    INSERT INTO public.workspace_settings (workspace_id, default_language, default_ai_model)
    VALUES (workspace_id_new, 'id', 'gemini-1.5-flash');

    RETURN NEW;
END;
$$;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
