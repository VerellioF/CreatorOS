-- ==============================================================================
-- MIGRATION: 20261031030000_phase4_ai_production_studio.sql
-- PRODUCT: CreatorOS AI (Phase 4 — AI Production Studio)
-- ARCHITECTURE: Modular Monolith, Strict Multi-Tenant RLS, Canonical Lock Hierarchy
-- ==============================================================================
-- SECURITY, PROVENANCE & MEDIA WORKER GUARANTEES:
-- 1. 100% Row Level Security (RLS) enforced across all 4 Phase 4 tables:
--      - `public.storyboards`
--      - `public.media_assets`
--      - `public.generation_jobs`
--      - `public.video_projects`
-- 2. Strict Cross-Tenant Foreign Key Isolation:
--      - Nullable cross-entity links (`content_item_id`, `storyboard_id`,
--        `latest_export_asset_id`, `ai_usage_id`, `agent_run_id`) are validated
--        in `enforce_phase4_tenant_fk_integrity()` to guarantee tenant boundary.
-- 3. Asynchronous Job State Machine:
--      - `generation_jobs` tracks full lifecycle:
--        'queued' -> 'processing' -> 'completed' / 'failed' / 'cancelled'.
--      - Progress percentage is clamped between 0 and 100.
--      - Max attempts and error logging prevent unbounded retry cascades.
-- 4. Audit & Immutability:
--      - `set_updated_at()` and `enforce_immutable_tenant_keys()` protect primary keys
--        and `workspace_id` from tampering.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABLE: storyboards
-- Scene-by-scene visual and audio planning derived from scripts or scratch
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storyboards (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    visual_theme TEXT DEFAULT 'cinematic' NOT NULL,
    scenes JSONB DEFAULT '[]'::jsonb NOT NULL,
    total_duration_seconds INT DEFAULT 60 NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_storyboards_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_storyboards_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title)) >= 2
            AND pg_catalog.char_length(title) <= 220
        ),
    CONSTRAINT check_storyboards_theme_len
        CHECK (pg_catalog.char_length(visual_theme) <= 100),
    CONSTRAINT check_storyboards_scenes_array
        CHECK (pg_catalog.jsonb_typeof(scenes) = 'array'),
    CONSTRAINT check_storyboards_duration
        CHECK (total_duration_seconds BETWEEN 1 AND 7200)
);

ALTER TABLE public.storyboards OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 2. TABLE: media_assets
-- Real generated or imported images, voiceover audio, video clips, and exported files
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
    storyboard_id UUID REFERENCES public.storyboards(id) ON DELETE SET NULL,
    asset_type VARCHAR(40) NOT NULL,
    title TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size_bytes BIGINT DEFAULT 0 NOT NULL,
    duration_seconds NUMERIC(10,2),
    dimensions JSONB DEFAULT '{}'::jsonb NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_media_assets_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_media_assets_type
        CHECK (asset_type IN ('image', 'thumbnail', 'brand_visual', 'voiceover', 'video_clip', 'exported_video', 'subtitle')),
    CONSTRAINT check_media_assets_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title)) >= 1
            AND pg_catalog.char_length(title) <= 250
        ),
    CONSTRAINT check_media_assets_storage_path_len
        CHECK (pg_catalog.char_length(storage_path) >= 1),
    CONSTRAINT check_media_assets_public_url_len
        CHECK (pg_catalog.char_length(public_url) >= 1),
    CONSTRAINT check_media_assets_size_nonneg
        CHECK (file_size_bytes >= 0),
    CONSTRAINT check_media_assets_json_types
        CHECK (
            pg_catalog.jsonb_typeof(dimensions) = 'object'
            AND pg_catalog.jsonb_typeof(metadata) = 'object'
        )
);

ALTER TABLE public.media_assets OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 3. TABLE: generation_jobs
-- Asynchronous rendering and generation job queue with progress telemetry
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_jobs (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'queued' NOT NULL,
    progress_percent INT DEFAULT 0 NOT NULL,
    input_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    output_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    error_message TEXT,
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 3 NOT NULL,
    provider VARCHAR(50) NOT NULL,
    credits_cost INT DEFAULT 0 NOT NULL,
    ai_usage_id UUID REFERENCES public.ai_provider_usage(id) ON DELETE SET NULL,
    agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_generation_jobs_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_generation_jobs_type
        CHECK (job_type IN ('image_generation', 'voice_generation', 'video_generation', 'timeline_export', 'subtitle_generation')),
    CONSTRAINT check_generation_jobs_status
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_generation_jobs_progress
        CHECK (progress_percent BETWEEN 0 AND 100),
    CONSTRAINT check_generation_jobs_attempts
        CHECK (attempts >= 0 AND attempts <= max_attempts + 5),
    CONSTRAINT check_generation_jobs_max_attempts
        CHECK (max_attempts >= 1 AND max_attempts <= 10),
    CONSTRAINT check_generation_jobs_credits
        CHECK (credits_cost >= 0),
    CONSTRAINT check_generation_jobs_payloads
        CHECK (
            pg_catalog.jsonb_typeof(input_payload) = 'object'
            AND pg_catalog.jsonb_typeof(output_payload) = 'object'
        )
);

ALTER TABLE public.generation_jobs OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 4. TABLE: video_projects
-- Multi-track timeline projects (clips, trims, text overlays, audio, subtitles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_projects (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
    storyboard_id UUID REFERENCES public.storyboards(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    aspect_ratio VARCHAR(20) DEFAULT '9:16' NOT NULL,
    resolution VARCHAR(20) DEFAULT '1080p' NOT NULL,
    fps INT DEFAULT 30 NOT NULL,
    timeline_data JSONB DEFAULT '{"tracks":[], "duration":0}'::jsonb NOT NULL,
    latest_export_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_video_projects_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_video_projects_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title)) >= 2
            AND pg_catalog.char_length(title) <= 220
        ),
    CONSTRAINT check_video_projects_aspect
        CHECK (aspect_ratio IN ('9:16', '16:9', '1:1', '4:5')),
    CONSTRAINT check_video_projects_res
        CHECK (resolution IN ('720p', '1080p', '4k')),
    CONSTRAINT check_video_projects_fps
        CHECK (fps IN (24, 25, 30, 60)),
    CONSTRAINT check_video_projects_timeline
        CHECK (pg_catalog.jsonb_typeof(timeline_data) = 'object')
);

ALTER TABLE public.video_projects OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_storyboards_ws_created
    ON public.storyboards(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storyboards_content_item
    ON public.storyboards(content_item_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_ws_type_created
    ON public.media_assets(workspace_id, asset_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_storyboard
    ON public.media_assets(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_content_item
    ON public.media_assets(content_item_id);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_ws_status_created
    ON public.generation_jobs(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_type
    ON public.generation_jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_video_projects_ws_created
    ON public.video_projects(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_projects_storyboard
    ON public.video_projects(storyboard_id);

-- ------------------------------------------------------------------------------
-- 6. CROSS-TENANT FK INTEGRITY TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_phase4_tenant_fk_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_TABLE_NAME = 'storyboards' THEN
        IF NEW.content_item_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.content_items ci
            WHERE ci.id = NEW.content_item_id AND ci.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: content_item_id % does not belong to workspace %.', NEW.content_item_id, NEW.workspace_id;
        END IF;

    ELSIF TG_TABLE_NAME = 'media_assets' THEN
        IF NEW.content_item_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.content_items ci
            WHERE ci.id = NEW.content_item_id AND ci.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: content_item_id % does not belong to workspace %.', NEW.content_item_id, NEW.workspace_id;
        END IF;
        IF NEW.storyboard_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.storyboards sb
            WHERE sb.id = NEW.storyboard_id AND sb.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: storyboard_id % does not belong to workspace %.', NEW.storyboard_id, NEW.workspace_id;
        END IF;

    ELSIF TG_TABLE_NAME = 'video_projects' THEN
        IF NEW.content_item_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.content_items ci
            WHERE ci.id = NEW.content_item_id AND ci.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: content_item_id % does not belong to workspace %.', NEW.content_item_id, NEW.workspace_id;
        END IF;
        IF NEW.storyboard_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.storyboards sb
            WHERE sb.id = NEW.storyboard_id AND sb.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: storyboard_id % does not belong to workspace %.', NEW.storyboard_id, NEW.workspace_id;
        END IF;
        IF NEW.latest_export_asset_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.media_assets ma
            WHERE ma.id = NEW.latest_export_asset_id AND ma.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: latest_export_asset_id % does not belong to workspace %.', NEW.latest_export_asset_id, NEW.workspace_id;
        END IF;

    ELSIF TG_TABLE_NAME = 'generation_jobs' THEN
        IF NEW.ai_usage_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.ai_provider_usage pu
            WHERE pu.id = NEW.ai_usage_id AND pu.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: ai_usage_id % does not belong to workspace %.', NEW.ai_usage_id, NEW.workspace_id;
        END IF;
        IF NEW.agent_run_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.agent_runs ar
            WHERE ar.id = NEW.agent_run_id AND ar.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: agent_run_id % does not belong to workspace %.', NEW.agent_run_id, NEW.workspace_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_phase4_tenant_fk_integrity() OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 7. ATTACH UPDATED_AT, IMMUTABLE KEYS & FK INTEGRITY TRIGGERS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'storyboards',
        'media_assets',
        'generation_jobs',
        'video_projects'
    ]
    LOOP
        EXECUTE pg_catalog.format(
            'CREATE OR REPLACE TRIGGER trigger_%I_updated_at
                 BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl, tbl, tbl, tbl
        );

        EXECUTE pg_catalog.format(
            'CREATE OR REPLACE TRIGGER trigger_%I_immutable_keys
                 BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.enforce_phase2_immutable_keys();',
            tbl, tbl, tbl, tbl
        );

        EXECUTE pg_catalog.format(
            'CREATE OR REPLACE TRIGGER trigger_%I_tenant_fk
                 BEFORE INSERT OR UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.enforce_phase4_tenant_fk_integrity();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. STORED PROCEDURES / RPCs FOR PHASE 4
-- ------------------------------------------------------------------------------

-- 8A. Save or Update Storyboard
CREATE OR REPLACE FUNCTION public.save_storyboard(
    target_workspace_id UUID,
    p_title TEXT,
    p_scenes JSONB,
    p_content_item_id UUID DEFAULT NULL,
    p_visual_theme TEXT DEFAULT 'cinematic',
    p_storyboard_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_result_id UUID;
    v_total_sec INT := 0;
    v_scene JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR p_title IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_title)) < 2 THEN
        RAISE EXCEPTION 'Invalid parameters: target_workspace_id and title (min 2 chars) are required.';
    END IF;

    IF NOT public.has_workspace_access(target_workspace_id, 'editor') THEN
        RAISE EXCEPTION 'Unauthorized: Editor role required to save storyboard.';
    END IF;

    -- Calculate total duration from scenes
    IF p_scenes IS NOT NULL AND pg_catalog.jsonb_typeof(p_scenes) = 'array' THEN
        FOR v_scene IN SELECT * FROM pg_catalog.jsonb_array_elements(p_scenes)
        LOOP
            v_total_sec := v_total_sec + COALESCE((v_scene->>'duration_seconds')::INT, 5);
        END LOOP;
    END IF;
    IF v_total_sec <= 0 THEN
        v_total_sec := 60;
    END IF;

    IF p_storyboard_id IS NOT NULL THEN
        UPDATE public.storyboards
        SET title = pg_catalog.btrim(p_title),
            scenes = COALESCE(p_scenes, '[]'::jsonb),
            visual_theme = COALESCE(p_visual_theme, 'cinematic'),
            content_item_id = p_content_item_id,
            total_duration_seconds = v_total_sec,
            updated_at = pg_catalog.now()
        WHERE id = p_storyboard_id
          AND workspace_id = target_workspace_id
        RETURNING id INTO v_result_id;

        IF v_result_id IS NULL THEN
            RAISE EXCEPTION 'Storyboard % not found in workspace %.', p_storyboard_id, target_workspace_id;
        END IF;
    ELSE
        INSERT INTO public.storyboards (
            workspace_id,
            content_item_id,
            title,
            visual_theme,
            scenes,
            total_duration_seconds,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            target_workspace_id,
            p_content_item_id,
            pg_catalog.btrim(p_title),
            COALESCE(p_visual_theme, 'cinematic'),
            COALESCE(p_scenes, '[]'::jsonb),
            v_total_sec,
            v_caller_id,
            pg_catalog.now(),
            pg_catalog.now()
        )
        RETURNING id INTO v_result_id;
    END IF;

    RETURN v_result_id;
END;
$$;

ALTER FUNCTION public.save_storyboard(UUID, TEXT, JSONB, UUID, TEXT, UUID) OWNER TO postgres;

-- 8B. Save or Update Video Project
CREATE OR REPLACE FUNCTION public.save_video_project(
    target_workspace_id UUID,
    p_title TEXT,
    p_timeline_data JSONB,
    p_aspect_ratio VARCHAR DEFAULT '9:16',
    p_resolution VARCHAR DEFAULT '1080p',
    p_fps INT DEFAULT 30,
    p_storyboard_id UUID DEFAULT NULL,
    p_content_item_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_result_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR p_title IS NULL OR pg_catalog.char_length(pg_catalog.btrim(p_title)) < 2 THEN
        RAISE EXCEPTION 'Invalid parameters: target_workspace_id and title (min 2 chars) are required.';
    END IF;

    IF NOT public.has_workspace_access(target_workspace_id, 'editor') THEN
        RAISE EXCEPTION 'Unauthorized: Editor role required to save video project.';
    END IF;

    IF p_project_id IS NOT NULL THEN
        UPDATE public.video_projects
        SET title = pg_catalog.btrim(p_title),
            timeline_data = COALESCE(p_timeline_data, '{"tracks":[], "duration":0}'::jsonb),
            aspect_ratio = COALESCE(p_aspect_ratio, '9:16'),
            resolution = COALESCE(p_resolution, '1080p'),
            fps = COALESCE(p_fps, 30),
            storyboard_id = p_storyboard_id,
            content_item_id = p_content_item_id,
            updated_at = pg_catalog.now()
        WHERE id = p_project_id
          AND workspace_id = target_workspace_id
        RETURNING id INTO v_result_id;

        IF v_result_id IS NULL THEN
            RAISE EXCEPTION 'Video project % not found in workspace %.', p_project_id, target_workspace_id;
        END IF;
    ELSE
        INSERT INTO public.video_projects (
            workspace_id,
            content_item_id,
            storyboard_id,
            title,
            aspect_ratio,
            resolution,
            fps,
            timeline_data,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            target_workspace_id,
            p_content_item_id,
            p_storyboard_id,
            pg_catalog.btrim(p_title),
            COALESCE(p_aspect_ratio, '9:16'),
            COALESCE(p_resolution, '1080p'),
            COALESCE(p_fps, 30),
            COALESCE(p_timeline_data, '{"tracks":[], "duration":0}'::jsonb),
            v_caller_id,
            pg_catalog.now(),
            pg_catalog.now()
        )
        RETURNING id INTO v_result_id;
    END IF;

    RETURN v_result_id;
END;
$$;

ALTER FUNCTION public.save_video_project(UUID, TEXT, JSONB, VARCHAR, VARCHAR, INT, UUID, UUID, UUID) OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.storyboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'storyboards',
        'media_assets',
        'generation_jobs',
        'video_projects'
    ]
    LOOP
        EXECUTE pg_catalog.format('DROP POLICY IF EXISTS "%s_select_member" ON public.%I;', tbl, tbl);
        EXECUTE pg_catalog.format('DROP POLICY IF EXISTS "%s_insert_editor" ON public.%I;', tbl, tbl);
        EXECUTE pg_catalog.format('DROP POLICY IF EXISTS "%s_update_editor" ON public.%I;', tbl, tbl);
        EXECUTE pg_catalog.format('DROP POLICY IF EXISTS "%s_delete_editor" ON public.%I;', tbl, tbl);

        EXECUTE pg_catalog.format(
            'CREATE POLICY "%s_select_member" ON public.%I
                 FOR SELECT USING (public.has_workspace_access(workspace_id, ''viewer''));',
            tbl, tbl
        );

        EXECUTE pg_catalog.format(
            'CREATE POLICY "%s_insert_editor" ON public.%I
                 FOR INSERT WITH CHECK (
                     public.has_workspace_access(workspace_id, ''editor'')
                     AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
                 );',
            tbl, tbl
        );

        EXECUTE pg_catalog.format(
            'CREATE POLICY "%s_update_editor" ON public.%I
                 FOR UPDATE
                 USING (public.has_workspace_access(workspace_id, ''editor''))
                 WITH CHECK (public.has_workspace_access(workspace_id, ''editor''));',
            tbl, tbl
        );

        EXECUTE pg_catalog.format(
            'CREATE POLICY "%s_delete_editor" ON public.%I
                 FOR DELETE USING (public.has_workspace_access(workspace_id, ''editor''));',
            tbl, tbl
        );
    END LOOP;
END;
$$;

COMMIT;
