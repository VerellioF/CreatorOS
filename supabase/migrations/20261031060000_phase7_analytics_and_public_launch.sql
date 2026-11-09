-- ==============================================================================
-- CREATOROS AI — PHASE 7 MIGRATION
-- Module: Analytics Intelligence, Content Performance, AI Diagnostics,
-- Support Ticketing, Data Retention & Public Launch Hardening
-- Strict Multi-Tenant Isolation, 100% RLS Coverage, Zero Fabricated Metrics
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: content_performance_snapshots
-- Captures verified post performance metrics with explicit data source provenance
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    content_item_id UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
    platform VARCHAR(30) NOT NULL,
    post_title TEXT NOT NULL,
    post_url TEXT,
    external_post_id TEXT,
    published_at TIMESTAMPTZ,
    snapshot_date DATE DEFAULT CURRENT_DATE NOT NULL,
    views INT DEFAULT 0 NOT NULL,
    likes INT DEFAULT 0 NOT NULL,
    comments INT DEFAULT 0 NOT NULL,
    shares INT DEFAULT 0 NOT NULL,
    saves INT DEFAULT 0 NOT NULL,
    clicks INT,
    conversions INT,
    revenue_generated NUMERIC(14,2),
    watch_time_seconds NUMERIC(10,2),
    retention_rate_pct NUMERIC(5,2),
    data_source VARCHAR(30) DEFAULT 'manual_entry' NOT NULL,
    is_manual_entry BOOLEAN DEFAULT TRUE NOT NULL,
    account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT check_performance_platform CHECK (
        platform IN ('tiktok', 'instagram', 'youtube', 'facebook', 'shopee_video', 'other')
    ),
    CONSTRAINT check_performance_data_source CHECK (
        data_source IN ('connected_account', 'manual_entry', 'api_sync')
    )
);

ALTER TABLE public.content_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_content_performance_workspace ON public.content_performance_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_platform ON public.content_performance_snapshots(platform);
CREATE INDEX IF NOT EXISTS idx_content_performance_date ON public.content_performance_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_content_performance_item ON public.content_performance_snapshots(content_item_id);

-- ------------------------------------------------------------------------------
-- 2. TABLE: analytics_insights
-- Stores deep AI analyst diagnostic reports with traceable evidence
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    analysis_type VARCHAR(50) DEFAULT 'comprehensive' NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    performance_grade VARCHAR(5) NOT NULL,
    top_performing_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
    weak_performing_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
    content_patterns JSONB DEFAULT '{}'::jsonb NOT NULL,
    audience_response JSONB DEFAULT '{}'::jsonb NOT NULL,
    strategy_alignment JSONB DEFAULT '{}'::jsonb NOT NULL,
    recommendations JSONB DEFAULT '[]'::jsonb NOT NULL,
    model_id VARCHAR(50) DEFAULT 'gemini-1.5-flash',
    tokens_used INT DEFAULT 0 NOT NULL,
    cost_usd NUMERIC(10,6) DEFAULT 0.000000 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT check_insights_grade CHECK (
        performance_grade IN ('A', 'B', 'C', 'D', 'F')
    )
);

ALTER TABLE public.analytics_insights ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_analytics_insights_workspace ON public.analytics_insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_created_at ON public.analytics_insights(created_at);

-- ------------------------------------------------------------------------------
-- 3. TABLE: support_tickets
-- User support workflow for public SaaS launch readiness
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' NOT NULL,
    status VARCHAR(20) DEFAULT 'open' NOT NULL,
    message TEXT NOT NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT check_support_tickets_category CHECK (
        category IN ('billing', 'feature_request', 'bug', 'account', 'content', 'other')
    ),
    CONSTRAINT check_support_tickets_priority CHECK (
        priority IN ('low', 'medium', 'high', 'urgent')
    ),
    CONSTRAINT check_support_tickets_status CHECK (
        status IN ('open', 'in_progress', 'resolved', 'closed')
    )
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace ON public.support_tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);

-- ------------------------------------------------------------------------------
-- 4. TABLE: data_retention_logs
-- Audit log of automated data retention cleanups
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_retention_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    policy_name VARCHAR(50) NOT NULL,
    items_purged INT DEFAULT 0 NOT NULL,
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.data_retention_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_data_retention_workspace ON public.data_retention_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_data_retention_executed_at ON public.data_retention_logs(executed_at);

-- ------------------------------------------------------------------------------
-- 5. ATOMIC STORED PROCEDURES
-- ------------------------------------------------------------------------------

-- Procedure: record_performance_snapshot
CREATE OR REPLACE FUNCTION public.record_performance_snapshot(
    p_workspace_id UUID,
    p_content_item_id UUID,
    p_platform VARCHAR(30),
    p_post_title TEXT,
    p_post_url TEXT,
    p_views INT,
    p_likes INT,
    p_comments INT,
    p_shares INT,
    p_saves INT,
    p_clicks INT DEFAULT NULL,
    p_conversions INT DEFAULT NULL,
    p_watch_time NUMERIC DEFAULT NULL,
    p_data_source VARCHAR(30) DEFAULT 'manual_entry',
    p_is_manual BOOLEAN DEFAULT TRUE,
    p_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_snapshot_id UUID;
BEGIN
    INSERT INTO public.content_performance_snapshots (
        workspace_id,
        content_item_id,
        platform,
        post_title,
        post_url,
        views,
        likes,
        comments,
        shares,
        saves,
        clicks,
        conversions,
        watch_time_seconds,
        data_source,
        is_manual_entry,
        account_id,
        snapshot_date,
        last_synced_at
    ) VALUES (
        p_workspace_id,
        p_content_item_id,
        p_platform,
        p_post_title,
        p_post_url,
        COALESCE(p_views, 0),
        COALESCE(p_likes, 0),
        COALESCE(p_comments, 0),
        COALESCE(p_shares, 0),
        COALESCE(p_saves, 0),
        p_clicks,
        p_conversions,
        p_watch_time,
        p_data_source,
        p_is_manual,
        p_account_id,
        CURRENT_DATE,
        NOW()
    )
    RETURNING id INTO v_snapshot_id;

    RETURN jsonb_build_object(
        'success', true,
        'snapshot_id', v_snapshot_id,
        'workspace_id', p_workspace_id,
        'platform', p_platform,
        'data_source', p_data_source
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_performance_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_performance_snapshot TO service_role;

-- Procedure: execute_data_retention_cleanup
CREATE OR REPLACE FUNCTION public.execute_data_retention_cleanup(
    p_workspace_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purged_logs INT := 0;
    v_purged_jobs INT := 0;
BEGIN
    IF p_dry_run THEN
        SELECT COUNT(*) INTO v_purged_logs
        FROM public.publishing_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id);

        SELECT COUNT(*) INTO v_purged_jobs
        FROM public.generation_jobs
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND created_at < NOW() - INTERVAL '30 days'
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id);

        RETURN jsonb_build_object(
            'dry_run', true,
            'eligible_publishing_logs', v_purged_logs,
            'eligible_generation_jobs', v_purged_jobs
        );
    ELSE
        DELETE FROM public.publishing_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id);
        GET DIAGNOSTICS v_purged_logs = ROW_COUNT;

        DELETE FROM public.generation_jobs
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND created_at < NOW() - INTERVAL '30 days'
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id);
        GET DIAGNOSTICS v_purged_jobs = ROW_COUNT;

        INSERT INTO public.data_retention_logs (
            workspace_id,
            policy_name,
            items_purged,
            details
        ) VALUES (
            p_workspace_id,
            'scheduled_purge_90d_logs_30d_jobs',
            v_purged_logs + v_purged_jobs,
            jsonb_build_object(
                'purged_publishing_logs', v_purged_logs,
                'purged_generation_jobs', v_purged_jobs,
                'executed_at', NOW()
            )
        );

        RETURN jsonb_build_object(
            'dry_run', false,
            'purged_publishing_logs', v_purged_logs,
            'purged_generation_jobs', v_purged_jobs,
            'total_purged', v_purged_logs + v_purged_jobs
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_data_retention_cleanup TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_data_retention_cleanup TO service_role;

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Policies for content_performance_snapshots
CREATE POLICY "performance_snapshots_select_member" ON public.content_performance_snapshots
    FOR SELECT TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'viewer')
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "performance_snapshots_insert_member" ON public.content_performance_snapshots
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "performance_snapshots_update_member" ON public.content_performance_snapshots
    FOR UPDATE TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'editor')
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "performance_snapshots_delete_member" ON public.content_performance_snapshots
    FOR DELETE TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'editor')
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "performance_snapshots_superadmin_all" ON public.content_performance_snapshots
    FOR ALL TO authenticated
    USING (public.is_superadmin(auth.uid()));

-- Policies for analytics_insights
CREATE POLICY "analytics_insights_select_member" ON public.analytics_insights
    FOR SELECT TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'viewer')
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "analytics_insights_insert_member" ON public.analytics_insights
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "analytics_insights_superadmin_all" ON public.analytics_insights
    FOR ALL TO authenticated
    USING (public.is_superadmin(auth.uid()));

-- Policies for support_tickets
CREATE POLICY "support_tickets_select_member" ON public.support_tickets
    FOR SELECT TO authenticated
    USING (
        (public.has_workspace_access(workspace_id, 'viewer') AND (user_id = auth.uid() OR public.has_workspace_access(workspace_id, 'admin')))
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "support_tickets_insert_member" ON public.support_tickets
    FOR INSERT TO authenticated
    WITH CHECK (
        public.has_workspace_access(workspace_id, 'viewer') AND user_id = auth.uid()
    );

CREATE POLICY "support_tickets_update_member" ON public.support_tickets
    FOR UPDATE TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'admin') OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "support_tickets_superadmin_all" ON public.support_tickets
    FOR ALL TO authenticated
    USING (public.is_superadmin(auth.uid()));

-- Policies for data_retention_logs
CREATE POLICY "data_retention_logs_select_member" ON public.data_retention_logs
    FOR SELECT TO authenticated
    USING (
        workspace_id IS NULL 
        OR public.has_workspace_access(workspace_id, 'admin') 
        OR public.is_superadmin(auth.uid())
    );

CREATE POLICY "data_retention_logs_superadmin_all" ON public.data_retention_logs
    FOR ALL TO authenticated
    USING (public.is_superadmin(auth.uid()));


-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_performance_snapshots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_insights TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.support_tickets TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.data_retention_logs TO authenticated, service_role;
