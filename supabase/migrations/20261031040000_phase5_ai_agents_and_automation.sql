-- =================================================================================================
-- CREATOROS AI — PHASE 5: AI AGENT ECOSYSTEM & WORKFLOW AUTOMATION MIGRATION
-- Migration Version: 20261031040000_phase5_ai_agents_and_automation.sql
-- Description:
--   1. Provision multi-tenant workflow persistence: workflow_runs, workflow_steps, workflow_schedules, workflow_logs
--   2. Enforce 100% PostgreSQL Row Level Security (RLS) with workspace isolation.
--   3. Add constraints for execution status, retry caps, timeout limits, and autonomous turn caps (max 5 turns).
--   4. Implement atomic SECURITY DEFINER RPCs for step advancement, approval, pause, resume, and cancellation.
-- =================================================================================================

-- 1. Table: workflow_runs
CREATE TABLE IF NOT EXISTS public.workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workflow_type VARCHAR(60) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' NOT NULL,
    current_step_index INT DEFAULT 0 NOT NULL,
    total_steps INT NOT NULL,
    total_tokens_used INT DEFAULT 0 NOT NULL,
    total_cost_usd NUMERIC(12,6) DEFAULT 0.000000 NOT NULL,
    total_credits_deducted INT DEFAULT 0 NOT NULL,
    initial_parameters JSONB DEFAULT '{}'::jsonb NOT NULL,
    workflow_context JSONB DEFAULT '{}'::jsonb NOT NULL,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT check_workflow_runs_status
        CHECK (status IN ('pending', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_workflow_runs_steps
        CHECK (current_step_index >= 0 AND total_steps > 0),
    CONSTRAINT check_workflow_runs_tokens_nonneg
        CHECK (total_tokens_used >= 0),
    CONSTRAINT check_workflow_runs_cost_nonneg
        CHECK (total_cost_usd >= 0),
    CONSTRAINT check_workflow_runs_credits_nonneg
        CHECK (total_credits_deducted >= 0)
);

ALTER TABLE public.workflow_runs OWNER TO postgres;

-- 2. Table: workflow_steps
CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    agent_name VARCHAR(60) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' NOT NULL,
    requires_approval BOOLEAN DEFAULT false NOT NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    input_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    output_payload JSONB,
    error_details TEXT,
    retry_count INT DEFAULT 0 NOT NULL,
    max_retries INT DEFAULT 2 NOT NULL,
    timeout_ms INT DEFAULT 60000 NOT NULL,
    tokens_used INT DEFAULT 0 NOT NULL,
    cost_usd NUMERIC(12,6) DEFAULT 0.000000 NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT check_workflow_steps_status
        CHECK (status IN ('pending', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_workflow_steps_retries
        CHECK (retry_count >= 0 AND retry_count <= max_retries + 1),
    CONSTRAINT check_workflow_steps_timeout
        CHECK (timeout_ms > 0),
    CONSTRAINT check_workflow_steps_tokens_nonneg
        CHECK (tokens_used >= 0),
    CONSTRAINT check_workflow_steps_cost_nonneg
        CHECK (cost_usd >= 0),
    CONSTRAINT uq_workflow_steps_run_step
        UNIQUE (workflow_run_id, step_index)
);

ALTER TABLE public.workflow_steps OWNER TO postgres;

-- 3. Table: workflow_schedules (Automation & Recurring Workflows)
CREATE TABLE IF NOT EXISTS public.workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workflow_type VARCHAR(60) NOT NULL,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    max_autonomous_turns INT DEFAULT 5 NOT NULL,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT check_workflow_schedules_max_turns
        CHECK (max_autonomous_turns > 0 AND max_autonomous_turns <= 5)
);

ALTER TABLE public.workflow_schedules OWNER TO postgres;

-- 4. Table: workflow_logs
CREATE TABLE IF NOT EXISTS public.workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    workflow_run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    workflow_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
    agent_name VARCHAR(60) NOT NULL,
    log_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT check_workflow_logs_level
        CHECK (log_level IN ('info', 'warn', 'error', 'debug'))
);

ALTER TABLE public.workflow_logs OWNER TO postgres;

-- Indexes for performance & tenant isolation
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workspace_status ON public.workflow_runs (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_at ON public.workflow_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run_index ON public.workflow_steps (workflow_run_id, step_index);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workspace ON public.workflow_steps (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_workspace ON public.workflow_schedules (workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_run_step ON public.workflow_logs (workflow_run_id, workflow_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workspace_time ON public.workflow_logs (workspace_id, created_at DESC);

-- Enable RLS on all 4 tables
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: workflow_runs
DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_runs_select_member" ON public.workflow_runs;
END $$;

CREATE POLICY "workflow_runs_select_member"
    ON public.workflow_runs FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_runs_insert_editor" ON public.workflow_runs;
END $$;

CREATE POLICY "workflow_runs_insert_editor"
    ON public.workflow_runs FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']::public.workspace_role[]));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_runs_update_editor" ON public.workflow_runs;
END $$;

CREATE POLICY "workflow_runs_update_editor"
    ON public.workflow_runs FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']::public.workspace_role[]));

-- RLS Policies: workflow_steps
DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_steps_select_member" ON public.workflow_steps;
END $$;

CREATE POLICY "workflow_steps_select_member"
    ON public.workflow_steps FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_steps_insert_editor" ON public.workflow_steps;
END $$;

CREATE POLICY "workflow_steps_insert_editor"
    ON public.workflow_steps FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']::public.workspace_role[]));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_steps_update_editor" ON public.workflow_steps;
END $$;

CREATE POLICY "workflow_steps_update_editor"
    ON public.workflow_steps FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']::public.workspace_role[]));

-- RLS Policies: workflow_schedules
DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_schedules_select_member" ON public.workflow_schedules;
END $$;

CREATE POLICY "workflow_schedules_select_member"
    ON public.workflow_schedules FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_schedules_insert_admin" ON public.workflow_schedules;
END $$;

CREATE POLICY "workflow_schedules_insert_admin"
    ON public.workflow_schedules FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']::public.workspace_role[]));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_schedules_update_admin" ON public.workflow_schedules;
END $$;

CREATE POLICY "workflow_schedules_update_admin"
    ON public.workflow_schedules FOR UPDATE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']::public.workspace_role[]));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_schedules_delete_admin" ON public.workflow_schedules;
END $$;

CREATE POLICY "workflow_schedules_delete_admin"
    ON public.workflow_schedules FOR DELETE
    TO authenticated
    USING (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin']::public.workspace_role[]));

-- RLS Policies: workflow_logs
DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_logs_select_member" ON public.workflow_logs;
END $$;

CREATE POLICY "workflow_logs_select_member"
    ON public.workflow_logs FOR SELECT
    TO authenticated
    USING (public.has_workspace_access(workspace_id));

DO $$ BEGIN
DROP POLICY IF EXISTS "workflow_logs_insert_editor" ON public.workflow_logs;
END $$;

CREATE POLICY "workflow_logs_insert_editor"
    ON public.workflow_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner', 'admin', 'editor']::public.workspace_role[]));

-- =================================================================================================
-- ATOMIC STORED PROCEDURES (SECURITY DEFINER)
-- =================================================================================================

-- 1. Advance workflow step
CREATE OR REPLACE FUNCTION public.advance_workflow_step(
    p_run_id UUID,
    p_step_index INT,
    p_output JSONB,
    p_tokens INT DEFAULT 0,
    p_cost NUMERIC(12,6) DEFAULT 0.000000,
    p_credits INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run RECORD;
    v_step RECORD;
    v_next_step RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_new_status VARCHAR(30);
BEGIN
    -- Lock workflow run
    SELECT * INTO v_run
    FROM public.workflow_runs
    WHERE id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workflow run % not found', p_run_id;
    END IF;

    -- Update current step to completed
    UPDATE public.workflow_steps
    SET status = 'completed',
        output_payload = p_output,
        tokens_used = tokens_used + p_tokens,
        cost_usd = cost_usd + p_cost,
        completed_at = v_now
    WHERE workflow_run_id = p_run_id AND step_index = p_step_index
    RETURNING * INTO v_step;

    -- Determine if next step exists
    IF p_step_index + 1 < v_run.total_steps THEN
        -- Check if next step requires approval
        SELECT * INTO v_next_step
        FROM public.workflow_steps
        WHERE workflow_run_id = p_run_id AND step_index = p_step_index + 1;

        IF v_next_step.requires_approval THEN
            v_new_status := 'waiting_approval';
            UPDATE public.workflow_steps
            SET status = 'waiting_approval'
            WHERE workflow_run_id = p_run_id AND step_index = p_step_index + 1;
        ELSE
            v_new_status := 'running';
        END IF;

        UPDATE public.workflow_runs
        SET current_step_index = p_step_index + 1,
            status = v_new_status,
            total_tokens_used = total_tokens_used + p_tokens,
            total_cost_usd = total_cost_usd + p_cost,
            total_credits_deducted = total_credits_deducted + p_credits,
            updated_at = v_now
        WHERE id = p_run_id;
    ELSE
        -- All steps completed
        UPDATE public.workflow_runs
        SET status = 'completed',
            completed_at = v_now,
            total_tokens_used = total_tokens_used + p_tokens,
            total_cost_usd = total_cost_usd + p_cost,
            total_credits_deducted = total_credits_deducted + p_credits,
            updated_at = v_now
        WHERE id = p_run_id;
        v_new_status := 'completed';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'workflowRunId', p_run_id,
        'completedStepIndex', p_step_index,
        'nextStatus', v_new_status
    );
END;
$$;

-- 2. Approve workflow step (Human in the Loop)
CREATE OR REPLACE FUNCTION public.approve_workflow_step(
    p_run_id UUID,
    p_step_index INT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT * INTO v_run
    FROM public.workflow_runs
    WHERE id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workflow run % not found', p_run_id;
    END IF;

    IF v_run.status <> 'waiting_approval' THEN
        RAISE EXCEPTION 'Workflow run is not waiting for approval (current status: %)', v_run.status;
    END IF;

    -- Update step to approved
    UPDATE public.workflow_steps
    SET status = 'pending',
        approved_by = p_user_id,
        approved_at = v_now
    WHERE workflow_run_id = p_run_id AND step_index = p_step_index;

    -- Resume run to running
    UPDATE public.workflow_runs
    SET status = 'running',
        updated_at = v_now
    WHERE id = p_run_id;

    RETURN jsonb_build_object(
        'success', true,
        'workflowRunId', p_run_id,
        'approvedStepIndex', p_step_index,
        'newStatus', 'running'
    );
END;
$$;

-- 3. Pause workflow run
CREATE OR REPLACE FUNCTION public.pause_workflow_run(p_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.workflow_runs
    SET status = 'waiting_approval',
        updated_at = clock_timestamp()
    WHERE id = p_run_id AND status = 'running';

    RETURN jsonb_build_object('success', true, 'workflowRunId', p_run_id, 'status', 'waiting_approval');
END;
$$;

-- 4. Resume workflow run
CREATE OR REPLACE FUNCTION public.resume_workflow_run(p_run_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.workflow_runs
    SET status = 'running',
        updated_at = clock_timestamp()
    WHERE id = p_run_id AND status = 'waiting_approval';

    RETURN jsonb_build_object('success', true, 'workflowRunId', p_run_id, 'status', 'running');
END;
$$;

-- 5. Cancel workflow run
CREATE OR REPLACE FUNCTION public.cancel_workflow_run(p_run_id UUID, p_reason TEXT DEFAULT 'Cancelled by user')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    UPDATE public.workflow_steps
    SET status = 'cancelled',
        completed_at = v_now
    WHERE workflow_run_id = p_run_id AND status IN ('pending', 'running', 'waiting_approval');

    UPDATE public.workflow_runs
    SET status = 'cancelled',
        error_message = p_reason,
        completed_at = v_now,
        updated_at = v_now
    WHERE id = p_run_id;

    RETURN jsonb_build_object('success', true, 'workflowRunId', p_run_id, 'status', 'cancelled');
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_workflow_step TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_workflow_step TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pause_workflow_run TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resume_workflow_run TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_workflow_run TO authenticated, service_role;
