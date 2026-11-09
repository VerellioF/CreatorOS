-- ==============================================================================
-- MIGRATION: 20261030020000_phase3_research_and_content_engine.sql
-- PRODUCT: CreatorOS AI (Phase 3 — Research, Strategy & Content Engine)
-- ARCHITECTURE: Modular Monolith, Strict Multi-Tenant RLS, Canonical Lock Hierarchy
-- ==============================================================================
-- SECURITY, PROVENANCE & CONCURRENCY GUARANTEES:
-- 1. 100% Row Level Security (RLS) enforced across all 9 Phase 3 tables:
--      - `public.brand_profiles`
--      - `public.research_reports`
--      - `public.research_sources`
--      - `public.competitor_profiles`
--      - `public.content_strategies`
--      - `public.content_pillars`
--      - `public.content_ideas`
--      - `public.content_items`
--      - `public.scripts`
-- 2. Strict Cross-Tenant Foreign Key Isolation:
--      - Mandatory parent-child relations (`research_sources`, `content_pillars`,
--        `scripts`) enforce composite `(parent_id, workspace_id)` foreign keys.
--      - Nullable cross-entity links (`research_report_id`, `pillar_id`, `idea_id`,
--        `source_content_item_id`) are verified in `enforce_phase3_tenant_fk_integrity()`
--        to guarantee both rows belong to the exact same `workspace_id`.
-- 3. Research Provenance & Anti-Hallucination Schema Guards:
--      - `research_sources` requires valid `http(s)://` URLs, explicit `retrieved_at`
--        timestamps, extracted information, data limitations, and confidence rationale.
--      - `research_reports` separates `verified_facts` from `ai_interpretations`,
--        stores `trend_claims`, and enforces via `CHECK` constraint that when
--        `realtime_data_available = FALSE`, `realtime_unavailable_reason` is mandatory.
-- 4. Concurrency-Safe Strategy Activation & Script Versioning:
--      - `public.activate_content_strategy()` and `public.save_script_version()`
--        acquire Level 1 workspace boundary locks (`creatoros_internal.lock_workspace_boundary`)
--        before mutating partial-unique state (`is_active = TRUE`, `is_current = TRUE`).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABLE: brand_profiles
-- Reusable Brand Positioning & Voice Context per workspace
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_profiles (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    brand_name TEXT NOT NULL,
    tagline TEXT DEFAULT '' NOT NULL,
    positioning_statement TEXT DEFAULT '' NOT NULL,
    offer_summary TEXT DEFAULT '' NOT NULL,
    brand_values TEXT[] DEFAULT '{}' NOT NULL,
    voice_guidelines TEXT[] DEFAULT '{}' NOT NULL,
    color_palette JSONB DEFAULT '{"primary":"#4F46E5","secondary":"#06B6D4"}'::jsonb NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_brand_profiles_name_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(brand_name)) >= 2
            AND pg_catalog.char_length(brand_name) <= 120
        ),
    CONSTRAINT check_brand_profiles_tagline_len
        CHECK (pg_catalog.char_length(tagline) <= 240),
    CONSTRAINT check_brand_profiles_positioning_len
        CHECK (pg_catalog.char_length(positioning_statement) <= 1200),
    CONSTRAINT check_brand_profiles_offer_len
        CHECK (pg_catalog.char_length(offer_summary) <= 1200),
    CONSTRAINT check_brand_profiles_palette_obj
        CHECK (pg_catalog.jsonb_typeof(color_palette) = 'object')
);

ALTER TABLE public.brand_profiles OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 2. TABLES: research_reports & research_sources
-- Source-backed Trend, Competitor, and Audience Research dossiers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_reports (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    report_type VARCHAR(30) NOT NULL,
    title TEXT NOT NULL,
    topic_query TEXT NOT NULL,
    target_platform VARCHAR(30) DEFAULT 'tiktok' NOT NULL,
    summary TEXT NOT NULL,
    verified_facts JSONB DEFAULT '[]'::jsonb NOT NULL,
    ai_interpretations JSONB DEFAULT '[]'::jsonb NOT NULL,
    trend_claims JSONB DEFAULT '[]'::jsonb NOT NULL,
    audience_insights JSONB DEFAULT '[]'::jsonb NOT NULL,
    competitor_insights JSONB DEFAULT '[]'::jsonb NOT NULL,
    actionable_recommendations JSONB DEFAULT '[]'::jsonb NOT NULL,
    data_limitations TEXT NOT NULL,
    overall_confidence VARCHAR(20) NOT NULL,
    realtime_data_available BOOLEAN DEFAULT FALSE NOT NULL,
    realtime_unavailable_reason TEXT,
    retrieved_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_research_reports_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_research_reports_type
        CHECK (report_type IN ('trend', 'competitor', 'audience')),
    CONSTRAINT check_research_reports_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title)) >= 3
            AND pg_catalog.char_length(title) <= 200
        ),
    CONSTRAINT check_research_reports_query_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(topic_query)) >= 2
            AND pg_catalog.char_length(topic_query) <= 300
        ),
    CONSTRAINT check_research_reports_summary_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(summary)) >= 10
            AND pg_catalog.char_length(summary) <= 4000
        ),
    CONSTRAINT check_research_reports_limitations_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(data_limitations)) >= 10
            AND pg_catalog.char_length(data_limitations) <= 2500
        ),
    CONSTRAINT check_research_reports_confidence
        CHECK (overall_confidence IN ('high', 'medium', 'low')),
    CONSTRAINT check_research_reports_realtime_explanation
        CHECK (
            realtime_data_available = TRUE
            OR (
                realtime_unavailable_reason IS NOT NULL
                AND pg_catalog.char_length(pg_catalog.btrim(realtime_unavailable_reason)) >= 10
            )
        ),
    CONSTRAINT check_research_reports_json_arrays
        CHECK (
            pg_catalog.jsonb_typeof(verified_facts) = 'array'
            AND pg_catalog.jsonb_typeof(ai_interpretations) = 'array'
            AND pg_catalog.jsonb_typeof(trend_claims) = 'array'
            AND pg_catalog.jsonb_typeof(audience_insights) = 'array'
            AND pg_catalog.jsonb_typeof(competitor_insights) = 'array'
            AND pg_catalog.jsonb_typeof(actionable_recommendations) = 'array'
        )
);

ALTER TABLE public.research_reports OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.research_sources (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    report_id UUID NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL,
    relevant_extract TEXT NOT NULL,
    data_limitations TEXT NOT NULL,
    confidence_level VARCHAR(20) NOT NULL,
    confidence_rationale TEXT NOT NULL,
    source_origin VARCHAR(30) DEFAULT 'web_grounding' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT fk_research_sources_report_ws
        FOREIGN KEY (report_id, workspace_id)
        REFERENCES public.research_reports(id, workspace_id)
        ON DELETE CASCADE,
    CONSTRAINT check_research_sources_url_http
        CHECK (
            source_url ~* '^https?://[^\s]+$'
            AND pg_catalog.char_length(source_url) <= 2048
        ),
    CONSTRAINT check_research_sources_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(source_title)) >= 2
            AND pg_catalog.char_length(source_title) <= 300
        ),
    CONSTRAINT check_research_sources_extract_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(relevant_extract)) >= 5
            AND pg_catalog.char_length(relevant_extract) <= 3000
        ),
    CONSTRAINT check_research_sources_limitations_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(data_limitations)) >= 5
            AND pg_catalog.char_length(data_limitations) <= 1500
        ),
    CONSTRAINT check_research_sources_confidence
        CHECK (confidence_level IN ('high', 'medium', 'low')),
    CONSTRAINT check_research_sources_rationale_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(confidence_rationale)) >= 5
            AND pg_catalog.char_length(confidence_rationale) <= 1000
        ),
    CONSTRAINT check_research_sources_origin
        CHECK (source_origin IN ('web_grounding', 'rss_feed', 'user_url', 'competitor_evidence'))
);

ALTER TABLE public.research_sources OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 3. TABLE: competitor_profiles
-- Monitored competitors grounded in observed public evidence (no fabricated stats)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitor_profiles (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    handle TEXT NOT NULL,
    display_name TEXT DEFAULT '' NOT NULL,
    platform VARCHAR(30) NOT NULL,
    profile_url TEXT,
    follower_count_estimate INT,
    positioning_summary TEXT DEFAULT '' NOT NULL,
    observed_hooks JSONB DEFAULT '[]'::jsonb NOT NULL,
    top_performing_topics TEXT[] DEFAULT '{}' NOT NULL,
    content_gaps TEXT[] DEFAULT '{}' NOT NULL,
    evidence_notes TEXT DEFAULT '' NOT NULL,
    data_limitations TEXT DEFAULT 'Berdasarkan pengamatan publik; metrik retensi internal akun tidak tersedia.' NOT NULL,
    last_observed_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_competitor_profiles_handle_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(handle)) >= 2
            AND pg_catalog.char_length(handle) <= 100
        ),
    CONSTRAINT check_competitor_profiles_platform
        CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'linkedin', 'threads', 'x')),
    CONSTRAINT check_competitor_profiles_url
        CHECK (
            profile_url IS NULL
            OR (profile_url ~* '^https?://[^\s]+$' AND pg_catalog.char_length(profile_url) <= 1024)
        ),
    CONSTRAINT check_competitor_profiles_followers_nonneg
        CHECK (follower_count_estimate IS NULL OR follower_count_estimate >= 0),
    CONSTRAINT check_competitor_profiles_hooks_arr
        CHECK (pg_catalog.jsonb_typeof(observed_hooks) = 'array')
);

ALTER TABLE public.competitor_profiles OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 4. TABLES: content_strategies & content_pillars
-- Content Positioning, Strategy Blueprint, Opportunity Scoring & Editable Pillars
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_strategies (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    research_report_id UUID REFERENCES public.research_reports(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    positioning_statement TEXT NOT NULL,
    unique_differentiator TEXT DEFAULT '' NOT NULL,
    core_narrative TEXT DEFAULT '' NOT NULL,
    platform_distribution JSONB DEFAULT '[]'::jsonb NOT NULL,
    opportunity_scores JSONB DEFAULT '[]'::jsonb NOT NULL,
    publishing_frequency_per_week INT DEFAULT 4 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_content_strategies_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_content_strategies_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title)) >= 3
            AND pg_catalog.char_length(title) <= 180
        ),
    CONSTRAINT check_content_strategies_positioning_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(positioning_statement)) >= 10
            AND pg_catalog.char_length(positioning_statement) <= 1500
        ),
    CONSTRAINT check_content_strategies_freq
        CHECK (publishing_frequency_per_week BETWEEN 1 AND 21),
    CONSTRAINT check_content_strategies_json_arrays
        CHECK (
            pg_catalog.jsonb_typeof(platform_distribution) = 'array'
            AND pg_catalog.jsonb_typeof(opportunity_scores) = 'array'
        )
);

ALTER TABLE public.content_strategies OWNER TO postgres;

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_strategies_one_active
    ON public.content_strategies(workspace_id)
    WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.content_pillars (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    strategy_id UUID NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '' NOT NULL,
    objective VARCHAR(30) DEFAULT 'educate' NOT NULL,
    ratio_percentage INT DEFAULT 25 NOT NULL,
    example_topics TEXT[] DEFAULT '{}' NOT NULL,
    recommended_formats TEXT[] DEFAULT '{}' NOT NULL,
    color_code VARCHAR(16) DEFAULT '#4F46E5' NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_content_pillars_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT fk_content_pillars_strategy_ws
        FOREIGN KEY (strategy_id, workspace_id)
        REFERENCES public.content_strategies(id, workspace_id)
        ON DELETE CASCADE,
    CONSTRAINT check_content_pillars_name_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(name)) >= 2
            AND pg_catalog.char_length(name) <= 120
        ),
    CONSTRAINT check_content_pillars_desc_len
        CHECK (pg_catalog.char_length(description) <= 1000),
    CONSTRAINT check_content_pillars_objective
        CHECK (objective IN ('educate', 'trust', 'engage', 'convert')),
    CONSTRAINT check_content_pillars_ratio
        CHECK (ratio_percentage BETWEEN 5 AND 100)
);

ALTER TABLE public.content_pillars OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 5. TABLES: content_ideas, content_items & scripts
-- Categorized Ideas, Platform-Adapted Content Packages & Versioned Editable Scripts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_ideas (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL,
    research_report_id UUID REFERENCES public.research_reports(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    hook_concept TEXT NOT NULL,
    angle_type VARCHAR(30) DEFAULT 'curiosity' NOT NULL,
    target_platform VARCHAR(30) DEFAULT 'tiktok' NOT NULL,
    opportunity_score INT DEFAULT 70 NOT NULL,
    opportunity_rationale TEXT DEFAULT '' NOT NULL,
    research_trace TEXT DEFAULT '' NOT NULL,
    status VARCHAR(25) DEFAULT 'backlog' NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_content_ideas_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_content_ideas_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title)) >= 3
            AND pg_catalog.char_length(title) <= 220
        ),
    CONSTRAINT check_content_ideas_hook_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(hook_concept)) >= 5
            AND pg_catalog.char_length(hook_concept) <= 600
        ),
    CONSTRAINT check_content_ideas_angle
        CHECK (angle_type IN ('curiosity', 'contrarian', 'tutorial', 'case_study', 'story', 'myth_busting')),
    CONSTRAINT check_content_ideas_platform
        CHECK (target_platform IN ('tiktok', 'instagram', 'youtube', 'linkedin', 'threads', 'x')),
    CONSTRAINT check_content_ideas_score
        CHECK (opportunity_score BETWEEN 1 AND 100),
    CONSTRAINT check_content_ideas_status
        CHECK (status IN ('backlog', 'shortlisted', 'in_production', 'completed', 'archived'))
);

ALTER TABLE public.content_ideas OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.content_items (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL,
    idea_id UUID REFERENCES public.content_ideas(id) ON DELETE SET NULL,
    research_report_id UUID REFERENCES public.research_reports(id) ON DELETE SET NULL,
    source_content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    primary_platform VARCHAR(30) DEFAULT 'tiktok' NOT NULL,
    target_platforms VARCHAR(30)[] DEFAULT '{tiktok}' NOT NULL,
    content_format VARCHAR(50) DEFAULT 'short_video' NOT NULL,
    stage VARCHAR(30) DEFAULT 'draft' NOT NULL,
    hook_variants JSONB DEFAULT '[]'::jsonb NOT NULL,
    caption TEXT DEFAULT '' NOT NULL,
    call_to_action TEXT DEFAULT '' NOT NULL,
    cta_variants JSONB DEFAULT '[]'::jsonb NOT NULL,
    hashtags TEXT[] DEFAULT '{}' NOT NULL,
    hashtag_tiers JSONB DEFAULT '{}'::jsonb NOT NULL,
    platform_adaptation_notes TEXT DEFAULT '' NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT uq_content_items_id_ws UNIQUE (id, workspace_id),
    CONSTRAINT check_content_items_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(title)) >= 3
            AND pg_catalog.char_length(title) <= 220
        ),
    CONSTRAINT check_content_items_platform
        CHECK (primary_platform IN ('tiktok', 'instagram', 'youtube', 'linkedin', 'threads', 'x')),
    CONSTRAINT check_content_items_stage
        CHECK (stage IN ('draft', 'scripting', 'ready_for_production', 'ready_to_publish', 'published', 'archived')),
    CONSTRAINT check_content_items_caption_len
        CHECK (pg_catalog.char_length(caption) <= 5000),
    CONSTRAINT check_content_items_cta_len
        CHECK (pg_catalog.char_length(call_to_action) <= 600),
    CONSTRAINT check_content_items_json_types
        CHECK (
            pg_catalog.jsonb_typeof(hook_variants) = 'array'
            AND pg_catalog.jsonb_typeof(cta_variants) = 'array'
            AND pg_catalog.jsonb_typeof(hashtag_tiers) = 'object'
        )
);

ALTER TABLE public.content_items OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.scripts (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    content_item_id UUID NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    version INT DEFAULT 1 NOT NULL,
    target_platform VARCHAR(30) DEFAULT 'tiktok' NOT NULL,
    framework VARCHAR(30) DEFAULT 'PAS' NOT NULL,
    opening_hook TEXT NOT NULL,
    body_content TEXT NOT NULL,
    closing_cta TEXT NOT NULL,
    visual_and_audio_cues JSONB DEFAULT '[]'::jsonb NOT NULL,
    estimated_duration_seconds INT DEFAULT 45 NOT NULL,
    is_current BOOLEAN DEFAULT TRUE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT fk_scripts_content_item_ws
        FOREIGN KEY (content_item_id, workspace_id)
        REFERENCES public.content_items(id, workspace_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_scripts_item_version UNIQUE (content_item_id, version),
    CONSTRAINT check_scripts_version_pos
        CHECK (version >= 1),
    CONSTRAINT check_scripts_platform
        CHECK (target_platform IN ('tiktok', 'instagram', 'youtube', 'linkedin', 'threads', 'x')),
    CONSTRAINT check_scripts_framework
        CHECK (framework IN ('AIDA', 'PAS', 'BAB', 'Story', 'Listicle')),
    CONSTRAINT check_scripts_hook_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(opening_hook)) >= 3
            AND pg_catalog.char_length(opening_hook) <= 1200
        ),
    CONSTRAINT check_scripts_body_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(body_content)) >= 10
            AND pg_catalog.char_length(body_content) <= 15000
        ),
    CONSTRAINT check_scripts_cta_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(closing_cta)) >= 3
            AND pg_catalog.char_length(closing_cta) <= 1000
        ),
    CONSTRAINT check_scripts_duration
        CHECK (estimated_duration_seconds BETWEEN 5 AND 3600),
    CONSTRAINT check_scripts_cues_arr
        CHECK (pg_catalog.jsonb_typeof(visual_and_audio_cues) = 'array')
);

ALTER TABLE public.scripts OWNER TO postgres;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scripts_one_current
    ON public.scripts(content_item_id)
    WHERE is_current = TRUE;

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_research_reports_ws_type_created
    ON public.research_reports(workspace_id, report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_sources_report
    ON public.research_sources(report_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_ws
    ON public.research_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_competitor_profiles_ws_created
    ON public.competitor_profiles(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_strategies_ws_created
    ON public.content_strategies(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_pillars_strategy_sort
    ON public.content_pillars(strategy_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_content_ideas_ws_status_created
    ON public.content_ideas(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_ws_platform_created
    ON public.content_items(workspace_id, primary_platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scripts_item_version_desc
    ON public.scripts(content_item_id, version DESC);

-- ------------------------------------------------------------------------------
-- 7. IMMUTABILITY, UPDATED_AT & CROSS-TENANT FK INTEGRITY TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_phase3_tenant_fk_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_TABLE_NAME = 'content_strategies' THEN
        IF NEW.research_report_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.research_reports rr
            WHERE rr.id = NEW.research_report_id AND rr.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: research_report_id does not belong to workspace %.', NEW.workspace_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'content_ideas' THEN
        IF NEW.pillar_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.content_pillars cp
            WHERE cp.id = NEW.pillar_id AND cp.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: pillar_id does not belong to workspace %.', NEW.workspace_id;
        END IF;
        IF NEW.research_report_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.research_reports rr
            WHERE rr.id = NEW.research_report_id AND rr.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: research_report_id does not belong to workspace %.', NEW.workspace_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'content_items' THEN
        IF NEW.pillar_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.content_pillars cp
            WHERE cp.id = NEW.pillar_id AND cp.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: pillar_id does not belong to workspace %.', NEW.workspace_id;
        END IF;
        IF NEW.idea_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.content_ideas ci
            WHERE ci.id = NEW.idea_id AND ci.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: idea_id does not belong to workspace %.', NEW.workspace_id;
        END IF;
        IF NEW.research_report_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.research_reports rr
            WHERE rr.id = NEW.research_report_id AND rr.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: research_report_id does not belong to workspace %.', NEW.workspace_id;
        END IF;
        IF NEW.source_content_item_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.content_items src
            WHERE src.id = NEW.source_content_item_id AND src.workspace_id = NEW.workspace_id
        ) THEN
            RAISE EXCEPTION 'Cross-tenant reference violation: source_content_item_id does not belong to workspace %.', NEW.workspace_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_phase3_tenant_fk_integrity() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_phase3_tenant_fk_integrity() FROM PUBLIC, anon, authenticated, service_role;

-- Attach immutability (`enforce_phase2_immutable_keys`) and `set_updated_at` triggers
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'brand_profiles',
        'research_reports',
        'competitor_profiles',
        'content_strategies',
        'content_pillars',
        'content_ideas',
        'content_items',
        'scripts'
    ]
    LOOP
        EXECUTE pg_catalog.format(
            'DROP TRIGGER IF EXISTS trigger_%I_updated_at ON public.%I;
             CREATE TRIGGER trigger_%I_updated_at
                 BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
            tbl, tbl, tbl, tbl
        );

        EXECUTE pg_catalog.format(
            'DROP TRIGGER IF EXISTS trigger_%I_immutable_keys ON public.%I;
             CREATE TRIGGER trigger_%I_immutable_keys
                 BEFORE UPDATE ON public.%I
                 FOR EACH ROW EXECUTE FUNCTION public.enforce_phase2_immutable_keys();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trigger_research_sources_immutable_keys ON public.research_sources;
CREATE TRIGGER trigger_research_sources_immutable_keys
    BEFORE UPDATE ON public.research_sources
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase2_immutable_keys();

DROP TRIGGER IF EXISTS trigger_content_strategies_tenant_fk ON public.content_strategies;
CREATE TRIGGER trigger_content_strategies_tenant_fk
    BEFORE INSERT OR UPDATE ON public.content_strategies
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase3_tenant_fk_integrity();

DROP TRIGGER IF EXISTS trigger_content_ideas_tenant_fk ON public.content_ideas;
CREATE TRIGGER trigger_content_ideas_tenant_fk
    BEFORE INSERT OR UPDATE ON public.content_ideas
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase3_tenant_fk_integrity();

DROP TRIGGER IF EXISTS trigger_content_items_tenant_fk ON public.content_items;
CREATE TRIGGER trigger_content_items_tenant_fk
    BEFORE INSERT OR UPDATE ON public.content_items
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase3_tenant_fk_integrity();

-- ------------------------------------------------------------------------------
-- 8. VALIDATED CLIENT-CALLABLE RPCs FOR PHASE 3
-- ------------------------------------------------------------------------------

-- 8A. Atomic Active Content Strategy Switcher RPC
CREATE OR REPLACE FUNCTION public.activate_content_strategy(
    target_workspace_id UUID,
    target_strategy_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_found_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR target_strategy_id IS NULL THEN
        RAISE EXCEPTION 'Invalid arguments: workspace_id and strategy_id are required.';
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    -- Level 2 Verification: Editor+ role required
    IF NOT public.has_workspace_access(target_workspace_id, 'editor') THEN
        RAISE EXCEPTION 'Unauthorized: Editor, Admin, or Owner role required to activate strategy.';
    END IF;

    SELECT cs.id INTO v_found_id
    FROM public.content_strategies cs
    WHERE cs.id = target_strategy_id
      AND cs.workspace_id = target_workspace_id
    FOR UPDATE;

    IF v_found_id IS NULL THEN
        RAISE EXCEPTION 'Not found: Content strategy % does not belong to workspace %.', target_strategy_id, target_workspace_id;
    END IF;

    UPDATE public.content_strategies
    SET is_active = FALSE,
        updated_at = pg_catalog.now()
    WHERE workspace_id = target_workspace_id
      AND is_active = TRUE
      AND id <> target_strategy_id;

    UPDATE public.content_strategies
    SET is_active = TRUE,
        updated_at = pg_catalog.now()
    WHERE id = target_strategy_id
      AND workspace_id = target_workspace_id;

    RETURN v_found_id;
END;
$$;

ALTER FUNCTION public.activate_content_strategy(UUID, UUID) OWNER TO postgres;

-- 8B. Atomic Concurrency-Safe Script Versioning RPC
CREATE OR REPLACE FUNCTION public.save_script_version(
    target_workspace_id UUID,
    target_content_item_id UUID,
    p_target_platform VARCHAR,
    p_framework VARCHAR,
    p_opening_hook TEXT,
    p_body_content TEXT,
    p_closing_cta TEXT,
    p_visual_cues JSONB DEFAULT '[]'::jsonb,
    p_duration_seconds INT DEFAULT 45
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_item_exists BOOLEAN;
    v_next_version INT;
    v_new_script_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR target_content_item_id IS NULL THEN
        RAISE EXCEPTION 'Invalid arguments: workspace_id and content_item_id are required.';
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    -- Level 2 Verification: Editor+ role required
    IF NOT public.has_workspace_access(target_workspace_id, 'editor') THEN
        RAISE EXCEPTION 'Unauthorized: Editor, Admin, or Owner role required to save script versions.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.content_items ci
        WHERE ci.id = target_content_item_id
          AND ci.workspace_id = target_workspace_id
        FOR UPDATE
    ) INTO v_item_exists;

    IF NOT v_item_exists THEN
        RAISE EXCEPTION 'Not found: Content item % does not belong to workspace %.', target_content_item_id, target_workspace_id;
    END IF;

    SELECT COALESCE(pg_catalog.max(s.version), 0) + 1 INTO v_next_version
    FROM public.scripts s
    WHERE s.content_item_id = target_content_item_id
      AND s.workspace_id = target_workspace_id;

    UPDATE public.scripts
    SET is_current = FALSE,
        updated_at = pg_catalog.now()
    WHERE content_item_id = target_content_item_id
      AND workspace_id = target_workspace_id
      AND is_current = TRUE;

    INSERT INTO public.scripts (
        content_item_id,
        workspace_id,
        version,
        target_platform,
        framework,
        opening_hook,
        body_content,
        closing_cta,
        visual_and_audio_cues,
        estimated_duration_seconds,
        is_current,
        created_by,
        created_at,
        updated_at
    )
    VALUES (
        target_content_item_id,
        target_workspace_id,
        v_next_version,
        p_target_platform,
        p_framework,
        p_opening_hook,
        p_body_content,
        p_closing_cta,
        COALESCE(p_visual_cues, '[]'::jsonb),
        p_duration_seconds,
        TRUE,
        v_caller_id,
        pg_catalog.now(),
        pg_catalog.now()
    )
    RETURNING id INTO v_new_script_id;

    RETURN v_new_script_id;
END;
$$;

ALTER FUNCTION public.save_script_version(
    UUID, UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, JSONB, INT
) OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'brand_profiles',
        'research_reports',
        'research_sources',
        'competitor_profiles',
        'content_strategies',
        'content_pillars',
        'content_ideas',
        'content_items',
        'scripts'
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

-- INSERT policies with created_by sender check where applicable
CREATE POLICY "brand_profiles_insert_editor" ON public.brand_profiles
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

CREATE POLICY "research_reports_insert_editor" ON public.research_reports
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

CREATE POLICY "research_sources_insert_editor" ON public.research_sources
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
    );

CREATE POLICY "competitor_profiles_insert_editor" ON public.competitor_profiles
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

CREATE POLICY "content_strategies_insert_editor" ON public.content_strategies
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

CREATE POLICY "content_pillars_insert_editor" ON public.content_pillars
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
    );

CREATE POLICY "content_ideas_insert_editor" ON public.content_ideas
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

CREATE POLICY "content_items_insert_editor" ON public.content_items
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

CREATE POLICY "scripts_insert_editor" ON public.scripts
    FOR INSERT WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

-- ------------------------------------------------------------------------------
-- 10. GRANTS & PERMISSIONS HARDENING (Principle of Least Privilege)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'brand_profiles',
        'research_reports',
        'research_sources',
        'competitor_profiles',
        'content_strategies',
        'content_pillars',
        'content_ideas',
        'content_items',
        'scripts'
    ]
    LOOP
        EXECUTE pg_catalog.format(
            'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role;
             GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated, service_role;',
            tbl, tbl
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_content_strategy(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_script_version(
    UUID, UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, JSONB, INT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.activate_content_strategy(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_script_version(
    UUID, UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, JSONB, INT
) TO authenticated, service_role;

COMMIT;
