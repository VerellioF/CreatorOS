-- ==============================================================================
-- MIGRATION: 20261030010000_phase2_creator_intelligence.sql
-- PRODUCT: CreatorOS AI (Phase 2 — Creator Intelligence, Usage Telemetry & Credit Ledger)
-- ARCHITECTURE: Modular Monolith, Strict Multi-Tenant RLS, Canonical Lock Hierarchy
-- ==============================================================================
-- SECURITY & CONCURRENCY GUARANTEES:
-- 1. 100% Row Level Security (RLS) enforced across all 6 Phase 2 tables:
--      - `public.onboarding_sessions`
--      - `public.creator_profiles`
--      - `public.niche_recommendations`
--      - `public.credit_wallets`
--      - `public.credit_transactions`
--      - `public.agent_runs`
--      - `public.ai_provider_usage`
-- 2. Tamper-Proof Billing & Telemetry Ledger:
--      - Direct `INSERT`, `UPDATE`, and `DELETE` privileges on `credit_wallets`,
--        `credit_transactions`, `agent_runs`, and `ai_provider_usage` are revoked
--        from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
--      - All credit deductions and AI provider telemetry writes execute atomically
--        through `public.record_ai_usage_and_deduct_credits()`, which enforces
--        authenticated caller verification (`auth.uid()`), workspace RBAC (`editor`+),
--        and canonical Level 1 (`creatoros_internal.lock_workspace_boundary`) ->
--        Level 4 (`credit_wallets FOR UPDATE`) lock ordering.
-- 3. Single Selected Niche Invariant:
--      - Enforced at the PostgreSQL index layer via partial unique index
--        `idx_niche_recommendations_one_selected` (`WHERE is_selected = TRUE`)
--        and mutated atomically via `public.select_preferred_niche()`.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. UPGRADE WORKSPACE SETTINGS DEFAULT AI MODEL TO GEMINI 3.8 FLASH
-- ------------------------------------------------------------------------------
ALTER TABLE public.workspace_settings
    ALTER COLUMN default_ai_model SET DEFAULT 'gemini-3.8-flash';

UPDATE public.workspace_settings
SET default_ai_model = CASE
        WHEN default_ai_model = 'gemini-1.5-pro' THEN 'gemini-4-argon'
        ELSE 'gemini-3.8-flash'
    END,
    updated_at = pg_catalog.now()
WHERE default_ai_model IN ('gemini-1.5-flash', 'gemini-1.5-pro');

-- ------------------------------------------------------------------------------
-- 2. TABLE: onboarding_sessions
-- Stores editable foundational & adaptive AI onboarding interview responses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'in_progress' NOT NULL,
    current_step INT DEFAULT 1 NOT NULL,
    core_answers JSONB DEFAULT '{}'::jsonb NOT NULL,
    adaptive_questions JSONB DEFAULT '[]'::jsonb NOT NULL,
    adaptive_answers JSONB DEFAULT '{}'::jsonb NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_onboarding_sessions_status
        CHECK (status IN ('in_progress', 'adaptive_interview', 'completed')),
    CONSTRAINT check_onboarding_sessions_step
        CHECK (current_step BETWEEN 1 AND 5),
    CONSTRAINT check_onboarding_sessions_core_answers_obj
        CHECK (pg_catalog.jsonb_typeof(core_answers) = 'object'),
    CONSTRAINT check_onboarding_sessions_adaptive_questions_arr
        CHECK (pg_catalog.jsonb_typeof(adaptive_questions) = 'array'),
    CONSTRAINT check_onboarding_sessions_adaptive_answers_obj
        CHECK (pg_catalog.jsonb_typeof(adaptive_answers) = 'object')
);

ALTER TABLE public.onboarding_sessions OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 3. TABLE: creator_profiles
-- Synthesized & user-editable Creator DNA, Audience Persona, Assessment & 30-Day Roadmap
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_profiles (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    creator_name TEXT NOT NULL,
    primary_niche TEXT NOT NULL,
    secondary_niches TEXT[] DEFAULT '{}' NOT NULL,
    unique_value_proposition TEXT DEFAULT '' NOT NULL,
    target_audience_summary TEXT,
    audience_persona JSONB DEFAULT '{}'::jsonb NOT NULL,
    tone_of_voice TEXT[] DEFAULT '{}' NOT NULL,
    personality_archetype TEXT,
    strengths TEXT[] DEFAULT '{}' NOT NULL,
    taboo_topics TEXT[] DEFAULT '{}' NOT NULL,
    primary_platforms VARCHAR(30)[] DEFAULT '{tiktok,instagram}' NOT NULL,
    preferred_formats TEXT[] DEFAULT '{}' NOT NULL,
    assessment_scores JSONB DEFAULT '{}'::jsonb NOT NULL,
    monetization_recommendations JSONB DEFAULT '[]'::jsonb NOT NULL,
    roadmap_30_days JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_creator_profiles_name_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(creator_name)) >= 2
            AND pg_catalog.char_length(creator_name) <= 100
        ),
    CONSTRAINT check_creator_profiles_niche_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(primary_niche)) >= 2
            AND pg_catalog.char_length(primary_niche) <= 160
        ),
    CONSTRAINT check_creator_profiles_uvp_len
        CHECK (pg_catalog.char_length(unique_value_proposition) <= 600),
    CONSTRAINT check_creator_profiles_audience_summary_len
        CHECK (target_audience_summary IS NULL OR pg_catalog.char_length(target_audience_summary) <= 1200),
    CONSTRAINT check_creator_profiles_archetype_len
        CHECK (personality_archetype IS NULL OR pg_catalog.char_length(personality_archetype) <= 120),
    CONSTRAINT check_creator_profiles_persona_obj
        CHECK (pg_catalog.jsonb_typeof(audience_persona) = 'object'),
    CONSTRAINT check_creator_profiles_assessment_obj
        CHECK (pg_catalog.jsonb_typeof(assessment_scores) = 'object'),
    CONSTRAINT check_creator_profiles_monetization_arr
        CHECK (pg_catalog.jsonb_typeof(monetization_recommendations) = 'array'),
    CONSTRAINT check_creator_profiles_roadmap_arr
        CHECK (pg_catalog.jsonb_typeof(roadmap_30_days) = 'array')
);

ALTER TABLE public.creator_profiles OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 4. TABLE: niche_recommendations
-- Structured niche discovery candidates with selection state per workspace
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.niche_recommendations (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    niche_title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    audience TEXT NOT NULL,
    content_opportunities JSONB DEFAULT '[]'::jsonb NOT NULL,
    competition_assessment JSONB DEFAULT '{}'::jsonb NOT NULL,
    required_skills TEXT[] DEFAULT '{}' NOT NULL,
    monetization_possibilities JSONB DEFAULT '[]'::jsonb NOT NULL,
    confidence_level VARCHAR(20) NOT NULL,
    confidence_score INT DEFAULT 70 NOT NULL,
    supporting_evidence JSONB DEFAULT '{}'::jsonb NOT NULL,
    is_selected BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_niche_recommendations_title_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(niche_title)) >= 2
            AND pg_catalog.char_length(niche_title) <= 160
        ),
    CONSTRAINT check_niche_recommendations_explanation_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(explanation)) >= 10
            AND pg_catalog.char_length(explanation) <= 2500
        ),
    CONSTRAINT check_niche_recommendations_audience_len
        CHECK (
            pg_catalog.char_length(pg_catalog.btrim(audience)) >= 5
            AND pg_catalog.char_length(audience) <= 1500
        ),
    CONSTRAINT check_niche_recommendations_confidence_level
        CHECK (confidence_level IN ('high', 'medium', 'exploratory')),
    CONSTRAINT check_niche_recommendations_confidence_score
        CHECK (confidence_score BETWEEN 1 AND 100),
    CONSTRAINT check_niche_recommendations_opportunities_arr
        CHECK (pg_catalog.jsonb_typeof(content_opportunities) = 'array'),
    CONSTRAINT check_niche_recommendations_competition_obj
        CHECK (pg_catalog.jsonb_typeof(competition_assessment) = 'object'),
    CONSTRAINT check_niche_recommendations_monetization_arr
        CHECK (pg_catalog.jsonb_typeof(monetization_possibilities) = 'array'),
    CONSTRAINT check_niche_recommendations_evidence_obj
        CHECK (pg_catalog.jsonb_typeof(supporting_evidence) = 'object')
);

ALTER TABLE public.niche_recommendations OWNER TO postgres;

-- Enforce at most ONE selected preferred niche per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_niche_recommendations_one_selected
    ON public.niche_recommendations(workspace_id)
    WHERE is_selected = TRUE;

-- ------------------------------------------------------------------------------
-- 5. TABLES: credit_wallets & credit_transactions
-- Workspace credit ledger (strictly SELECT-only to clients; mutated via RPC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_wallets (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    balance INT DEFAULT 50 NOT NULL,
    monthly_allowance INT DEFAULT 50 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_credit_wallets_non_negative
        CHECK (balance >= 0 AND monthly_allowance >= 0)
);

ALTER TABLE public.credit_wallets OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    wallet_id UUID REFERENCES public.credit_wallets(id) ON DELETE CASCADE NOT NULL,
    amount INT NOT NULL,
    balance_after INT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_credit_transactions_balance_after
        CHECK (balance_after >= 0),
    CONSTRAINT check_credit_transactions_nonzero_amount
        CHECK (amount <> 0),
    CONSTRAINT check_credit_transactions_type
        CHECK (transaction_type IN ('monthly_grant', 'top_up', 'ai_generation', 'refund'))
);

ALTER TABLE public.credit_transactions OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 6. TABLES: agent_runs & ai_provider_usage
-- AI orchestration trace and fine-grained token/cost telemetry
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_name VARCHAR(60) NOT NULL,
    session_id TEXT,
    input_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
    output_payload JSONB,
    status VARCHAR(20) DEFAULT 'completed' NOT NULL,
    error_details TEXT,
    total_tokens_used INT DEFAULT 0 NOT NULL,
    cost_usd NUMERIC(12,6) DEFAULT 0.000000 NOT NULL,
    started_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    completed_at TIMESTAMPTZ,
    CONSTRAINT check_agent_runs_status
        CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT check_agent_runs_tokens_nonneg
        CHECK (total_tokens_used >= 0),
    CONSTRAINT check_agent_runs_cost_nonneg
        CHECK (cost_usd >= 0)
);

ALTER TABLE public.agent_runs OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.ai_provider_usage (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_run_id UUID REFERENCES public.agent_runs(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    model_id VARCHAR(80) NOT NULL,
    operation_type VARCHAR(60) NOT NULL,
    prompt_tokens INT DEFAULT 0 NOT NULL,
    completion_tokens INT DEFAULT 0 NOT NULL,
    total_tokens INT DEFAULT 0 NOT NULL,
    cost_usd NUMERIC(12,6) DEFAULT 0.000000 NOT NULL,
    credits_charged INT DEFAULT 0 NOT NULL,
    duration_ms INT DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'success' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_ai_provider_usage_status
        CHECK (status IN ('success', 'failed', 'fallback_success')),
    CONSTRAINT check_ai_provider_usage_tokens
        CHECK (
            prompt_tokens >= 0
            AND completion_tokens >= 0
            AND total_tokens >= 0
            AND cost_usd >= 0
            AND credits_charged >= 0
            AND duration_ms >= 0
        )
);

ALTER TABLE public.ai_provider_usage OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_ws
    ON public.onboarding_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_ws
    ON public.creator_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_niche_recommendations_ws_created
    ON public.niche_recommendations(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_wallets_ws
    ON public.credit_wallets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_wallet_created
    ON public.credit_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_ws_started
    ON public.agent_runs(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_workspace
    ON public.ai_provider_usage(workspace_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. IMMUTABILITY & UPDATED_AT TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_phase2_immutable_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF NEW.id <> OLD.id
       OR NEW.workspace_id <> OLD.workspace_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
        RAISE EXCEPTION 'Data integrity violation: Resource identity (id, workspace_id, created_at) is immutable on %.', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_phase2_immutable_keys() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_phase2_immutable_keys() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trigger_onboarding_sessions_updated_at ON public.onboarding_sessions;
CREATE TRIGGER trigger_onboarding_sessions_updated_at
    BEFORE UPDATE ON public.onboarding_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_onboarding_sessions_immutable_keys ON public.onboarding_sessions;
CREATE TRIGGER trigger_onboarding_sessions_immutable_keys
    BEFORE UPDATE ON public.onboarding_sessions
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase2_immutable_keys();

DROP TRIGGER IF EXISTS trigger_creator_profiles_updated_at ON public.creator_profiles;
CREATE TRIGGER trigger_creator_profiles_updated_at
    BEFORE UPDATE ON public.creator_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_creator_profiles_immutable_keys ON public.creator_profiles;
CREATE TRIGGER trigger_creator_profiles_immutable_keys
    BEFORE UPDATE ON public.creator_profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase2_immutable_keys();

DROP TRIGGER IF EXISTS trigger_niche_recommendations_updated_at ON public.niche_recommendations;
CREATE TRIGGER trigger_niche_recommendations_updated_at
    BEFORE UPDATE ON public.niche_recommendations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_niche_recommendations_immutable_keys ON public.niche_recommendations;
CREATE TRIGGER trigger_niche_recommendations_immutable_keys
    BEFORE UPDATE ON public.niche_recommendations
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase2_immutable_keys();

DROP TRIGGER IF EXISTS trigger_credit_wallets_updated_at ON public.credit_wallets;
CREATE TRIGGER trigger_credit_wallets_updated_at
    BEFORE UPDATE ON public.credit_wallets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_credit_wallets_immutable_keys ON public.credit_wallets;
CREATE TRIGGER trigger_credit_wallets_immutable_keys
    BEFORE UPDATE ON public.credit_wallets
    FOR EACH ROW EXECUTE FUNCTION public.enforce_phase2_immutable_keys();

-- ------------------------------------------------------------------------------
-- 9. AUTOMATIC CREDIT WALLET PROVISIONING & IDEMPOTENT BACKFILL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION creatoros_internal.provision_workspace_wallet(
    p_workspace_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wallet_id UUID;
    v_inserted BOOLEAN := FALSE;
BEGIN
    IF p_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Wallet provisioning error: workspace_id cannot be NULL.';
    END IF;

    INSERT INTO public.credit_wallets (
        workspace_id,
        balance,
        monthly_allowance,
        created_at,
        updated_at
    )
    VALUES (
        p_workspace_id,
        50,
        50,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (workspace_id) DO NOTHING
    RETURNING id INTO v_wallet_id;

    IF v_wallet_id IS NOT NULL THEN
        v_inserted := TRUE;
    ELSE
        SELECT cw.id INTO v_wallet_id
        FROM public.credit_wallets cw
        WHERE cw.workspace_id = p_workspace_id;
    END IF;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet provisioning failure for workspace %.', p_workspace_id;
    END IF;

    IF v_inserted THEN
        INSERT INTO public.credit_transactions (
            wallet_id,
            amount,
            balance_after,
            transaction_type,
            description,
            created_at
        )
        VALUES (
            v_wallet_id,
            50,
            50,
            'monthly_grant',
            'Alokasi kredit awal workspace (Starter Grant)',
            pg_catalog.now()
        );
    END IF;

    RETURN v_wallet_id;
END;
$$;

ALTER FUNCTION creatoros_internal.provision_workspace_wallet(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION creatoros_internal.provision_workspace_wallet(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_workspace_credit_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM creatoros_internal.provision_workspace_wallet(NEW.id);
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_workspace_credit_wallet() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_workspace_credit_wallet() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS on_workspace_created_wallet ON public.workspaces;
CREATE TRIGGER on_workspace_created_wallet
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_credit_wallet();

-- Backfill credit wallets for all existing workspaces
DO $$
DECLARE
    ws_rec RECORD;
    v_missing_wallets BIGINT;
BEGIN
    FOR ws_rec IN
        SELECT w.id
        FROM public.workspaces w
        WHERE NOT EXISTS (
            SELECT 1 FROM public.credit_wallets cw
            WHERE cw.workspace_id = w.id
        )
        ORDER BY w.id ASC
    LOOP
        PERFORM creatoros_internal.provision_workspace_wallet(ws_rec.id);
    END LOOP;

    SELECT pg_catalog.count(*) INTO v_missing_wallets
    FROM public.workspaces w
    WHERE NOT EXISTS (
        SELECT 1 FROM public.credit_wallets cw
        WHERE cw.workspace_id = w.id
    );

    IF v_missing_wallets > 0 THEN
        RAISE EXCEPTION 'Phase 2 backfill post-condition failed: % workspaces missing credit_wallets.', v_missing_wallets;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. VALIDATED CLIENT-CALLABLE RPCs FOR PHASE 2
-- ------------------------------------------------------------------------------

-- 10A. Atomic AI Usage Telemetry & Credit Wallet Deduction RPC
-- Enforces Level 1 (`lock_workspace_boundary`) -> Level 2 (`has_workspace_access('editor')`)
-- -> Level 4 (`credit_wallets FOR UPDATE`) -> Level 5 (`agent_runs` + `ai_provider_usage`).
CREATE OR REPLACE FUNCTION public.record_ai_usage_and_deduct_credits(
    target_workspace_id UUID,
    p_agent_name VARCHAR,
    p_operation_type VARCHAR,
    p_provider VARCHAR,
    p_model_id VARCHAR,
    p_prompt_tokens INT,
    p_completion_tokens INT,
    p_total_tokens INT,
    p_cost_usd NUMERIC,
    p_credits_to_deduct INT,
    p_duration_ms INT,
    p_status VARCHAR DEFAULT 'success',
    p_input_summary JSONB DEFAULT '{}'::jsonb,
    p_output_summary JSONB DEFAULT NULL,
    p_error_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_wallet_id UUID;
    v_current_balance INT;
    v_new_balance INT;
    v_actual_deduction INT := 0;
    v_agent_run_id UUID;
    v_usage_id UUID;
    v_agent_status VARCHAR;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required for AI telemetry and credit operations.';
    END IF;

    IF target_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Invalid target: workspace_id cannot be NULL.';
    END IF;

    IF p_credits_to_deduct < 0 OR p_credits_to_deduct > 50 THEN
        RAISE EXCEPTION 'Invalid credit deduction amount: must be between 0 and 50.';
    END IF;

    IF p_prompt_tokens < 0 OR p_completion_tokens < 0 OR p_total_tokens < 0 OR p_cost_usd < 0 OR p_duration_ms < 0 THEN
        RAISE EXCEPTION 'Invalid usage metrics: token counts, cost, and duration must be non-negative.';
    END IF;

    IF p_status NOT IN ('success', 'failed', 'fallback_success') THEN
        RAISE EXCEPTION 'Invalid usage status: %', p_status;
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    -- Level 2 Verification: Active workspace membership with at least `editor` role
    IF NOT public.has_workspace_access(target_workspace_id, 'editor') THEN
        RAISE EXCEPTION 'Unauthorized: Editor, Admin, or Owner role required to execute AI operations in this workspace.';
    END IF;

    -- Ensure wallet exists & acquire Level 4 row lock
    PERFORM creatoros_internal.provision_workspace_wallet(target_workspace_id);

    SELECT cw.id, cw.balance INTO v_wallet_id, v_current_balance
    FROM public.credit_wallets cw
    WHERE cw.workspace_id = target_workspace_id
    FOR UPDATE;

    IF p_status IN ('success', 'fallback_success') THEN
        v_actual_deduction := p_credits_to_deduct;
        v_agent_status := 'completed';
    ELSE
        v_actual_deduction := 0;
        v_agent_status := 'failed';
    END IF;

    IF v_actual_deduction > 0 AND v_current_balance < v_actual_deduction THEN
        RAISE EXCEPTION 'Insufficient workspace credits: required %, available %.', v_actual_deduction, v_current_balance;
    END IF;

    v_new_balance := v_current_balance - v_actual_deduction;

    -- Level 5A: Record agent_runs trace
    INSERT INTO public.agent_runs (
        workspace_id,
        user_id,
        agent_name,
        input_payload,
        output_payload,
        status,
        error_details,
        total_tokens_used,
        cost_usd,
        started_at,
        completed_at
    )
    VALUES (
        target_workspace_id,
        v_caller_id,
        pg_catalog.substr(pg_catalog.btrim(p_agent_name), 1, 60),
        COALESCE(p_input_summary, '{}'::jsonb),
        p_output_summary,
        v_agent_status,
        p_error_details,
        p_total_tokens,
        p_cost_usd,
        pg_catalog.now() - (p_duration_ms * INTERVAL '1 millisecond'),
        pg_catalog.now()
    )
    RETURNING id INTO v_agent_run_id;

    -- Level 5B: Record ai_provider_usage entry
    INSERT INTO public.ai_provider_usage (
        workspace_id,
        user_id,
        agent_run_id,
        provider,
        model_id,
        operation_type,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_usd,
        credits_charged,
        duration_ms,
        status,
        created_at
    )
    VALUES (
        target_workspace_id,
        v_caller_id,
        v_agent_run_id,
        pg_catalog.substr(pg_catalog.btrim(p_provider), 1, 50),
        pg_catalog.substr(pg_catalog.btrim(p_model_id), 1, 80),
        pg_catalog.substr(pg_catalog.btrim(p_operation_type), 1, 60),
        p_prompt_tokens,
        p_completion_tokens,
        p_total_tokens,
        p_cost_usd,
        v_actual_deduction,
        p_duration_ms,
        p_status,
        pg_catalog.now()
    )
    RETURNING id INTO v_usage_id;

    -- Level 4 Ledger Commit: Deduct credits & record credit_transactions entry
    IF v_actual_deduction > 0 THEN
        UPDATE public.credit_wallets
        SET balance = v_new_balance,
            updated_at = pg_catalog.now()
        WHERE id = v_wallet_id;

        INSERT INTO public.credit_transactions (
            wallet_id,
            amount,
            balance_after,
            transaction_type,
            reference_id,
            description,
            created_at
        )
        VALUES (
            v_wallet_id,
            -v_actual_deduction,
            v_new_balance,
            'ai_generation',
            v_agent_run_id,
            pg_catalog.format('%s (%s)', p_agent_name, p_operation_type),
            pg_catalog.now()
        );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'agent_run_id', v_agent_run_id,
        'usage_id', v_usage_id,
        'credits_deducted', v_actual_deduction,
        'remaining_balance', v_new_balance
    );
END;
$$;

ALTER FUNCTION public.record_ai_usage_and_deduct_credits(
    UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INT, INT, INT, NUMERIC, INT, INT, VARCHAR, JSONB, JSONB, TEXT
) OWNER TO postgres;

-- 10B. Atomic Preferred Niche Selection RPC
-- Clears previous selection in workspace, marks `target_niche_id` as selected,
-- and synchronizes `creator_profiles.primary_niche` when a Creator DNA profile exists.
CREATE OR REPLACE FUNCTION public.select_preferred_niche(
    target_workspace_id UUID,
    target_niche_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_niche_title TEXT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required.';
    END IF;

    IF target_workspace_id IS NULL OR target_niche_id IS NULL THEN
        RAISE EXCEPTION 'Invalid arguments: workspace_id and niche_id are required.';
    END IF;

    -- Level 1 Lock: Workspace boundary
    PERFORM creatoros_internal.lock_workspace_boundary(target_workspace_id);

    -- Level 2 Verification: Editor+ role required
    IF NOT public.has_workspace_access(target_workspace_id, 'editor') THEN
        RAISE EXCEPTION 'Unauthorized: Editor, Admin, or Owner role required to select workspace niche.';
    END IF;

    SELECT nr.niche_title INTO v_niche_title
    FROM public.niche_recommendations nr
    WHERE nr.id = target_niche_id
      AND nr.workspace_id = target_workspace_id
    FOR UPDATE;

    IF v_niche_title IS NULL THEN
        RAISE EXCEPTION 'Not found: Niche recommendation % does not belong to workspace %.', target_niche_id, target_workspace_id;
    END IF;

    UPDATE public.niche_recommendations
    SET is_selected = FALSE,
        updated_at = pg_catalog.now()
    WHERE workspace_id = target_workspace_id
      AND is_selected = TRUE
      AND id <> target_niche_id;

    UPDATE public.niche_recommendations
    SET is_selected = TRUE,
        updated_at = pg_catalog.now()
    WHERE id = target_niche_id
      AND workspace_id = target_workspace_id;

    -- Synchronize Creator DNA primary_niche if profile already exists
    UPDATE public.creator_profiles
    SET primary_niche = v_niche_title,
        updated_at = pg_catalog.now()
    WHERE workspace_id = target_workspace_id;

    RETURN v_niche_title;
END;
$$;

ALTER FUNCTION public.select_preferred_niche(UUID, UUID) OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niche_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_usage ENABLE ROW LEVEL SECURITY;

-- Drop policies idempotently if re-running migration
DROP POLICY IF EXISTS "onboarding_sessions_select_member" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_sessions_insert_editor" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_sessions_update_editor" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "onboarding_sessions_delete_admin" ON public.onboarding_sessions;

DROP POLICY IF EXISTS "creator_profiles_select_member" ON public.creator_profiles;
DROP POLICY IF EXISTS "creator_profiles_insert_editor" ON public.creator_profiles;
DROP POLICY IF EXISTS "creator_profiles_update_editor" ON public.creator_profiles;
DROP POLICY IF EXISTS "creator_profiles_delete_admin" ON public.creator_profiles;

DROP POLICY IF EXISTS "niche_recommendations_select_member" ON public.niche_recommendations;
DROP POLICY IF EXISTS "niche_recommendations_insert_editor" ON public.niche_recommendations;
DROP POLICY IF EXISTS "niche_recommendations_update_editor" ON public.niche_recommendations;
DROP POLICY IF EXISTS "niche_recommendations_delete_editor" ON public.niche_recommendations;

DROP POLICY IF EXISTS "credit_wallets_select_member" ON public.credit_wallets;
DROP POLICY IF EXISTS "credit_transactions_select_member" ON public.credit_transactions;
DROP POLICY IF EXISTS "agent_runs_select_member" ON public.agent_runs;
DROP POLICY IF EXISTS "ai_provider_usage_select_member" ON public.ai_provider_usage;

-- ONBOARDING_SESSIONS POLICIES
CREATE POLICY "onboarding_sessions_select_member" ON public.onboarding_sessions
    FOR SELECT
    USING (public.has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "onboarding_sessions_insert_editor" ON public.onboarding_sessions
    FOR INSERT
    WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
    );

CREATE POLICY "onboarding_sessions_update_editor" ON public.onboarding_sessions
    FOR UPDATE
    USING (public.has_workspace_access(workspace_id, 'editor'))
    WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
    );

CREATE POLICY "onboarding_sessions_delete_admin" ON public.onboarding_sessions
    FOR DELETE
    USING (public.has_workspace_access(workspace_id, 'admin'));

-- CREATOR_PROFILES POLICIES
CREATE POLICY "creator_profiles_select_member" ON public.creator_profiles
    FOR SELECT
    USING (public.has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "creator_profiles_insert_editor" ON public.creator_profiles
    FOR INSERT
    WITH CHECK (public.has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "creator_profiles_update_editor" ON public.creator_profiles
    FOR UPDATE
    USING (public.has_workspace_access(workspace_id, 'editor'))
    WITH CHECK (public.has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "creator_profiles_delete_admin" ON public.creator_profiles
    FOR DELETE
    USING (public.has_workspace_access(workspace_id, 'admin'));

-- NICHE_RECOMMENDATIONS POLICIES
CREATE POLICY "niche_recommendations_select_member" ON public.niche_recommendations
    FOR SELECT
    USING (public.has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "niche_recommendations_insert_editor" ON public.niche_recommendations
    FOR INSERT
    WITH CHECK (
        public.has_workspace_access(workspace_id, 'editor')
        AND (created_by IS NULL OR created_by = (SELECT auth.uid()))
    );

CREATE POLICY "niche_recommendations_update_editor" ON public.niche_recommendations
    FOR UPDATE
    USING (public.has_workspace_access(workspace_id, 'editor'))
    WITH CHECK (public.has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "niche_recommendations_delete_editor" ON public.niche_recommendations
    FOR DELETE
    USING (public.has_workspace_access(workspace_id, 'editor'));

-- CREDIT_WALLETS, CREDIT_TRANSACTIONS, AGENT_RUNS, AI_PROVIDER_USAGE (SELECT-ONLY!)
CREATE POLICY "credit_wallets_select_member" ON public.credit_wallets
    FOR SELECT
    USING (public.has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "credit_transactions_select_member" ON public.credit_transactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.credit_wallets cw
            WHERE cw.id = public.credit_transactions.wallet_id
              AND public.has_workspace_access(cw.workspace_id, 'viewer')
        )
    );

CREATE POLICY "agent_runs_select_member" ON public.agent_runs
    FOR SELECT
    USING (public.has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "ai_provider_usage_select_member" ON public.ai_provider_usage
    FOR SELECT
    USING (public.has_workspace_access(workspace_id, 'viewer'));

-- ------------------------------------------------------------------------------
-- 12. GRANTS & PERMISSIONS HARDENING (Principle of Least Privilege)
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.onboarding_sessions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.creator_profiles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.niche_recommendations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.credit_wallets FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.credit_transactions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.agent_runs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.ai_provider_usage FROM PUBLIC, anon, authenticated, service_role;

-- Authenticated & service_role table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.onboarding_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.creator_profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.niche_recommendations TO authenticated, service_role;

-- Billing & telemetry tables are strictly SELECT-only; writes go exclusively via RPC
GRANT SELECT ON TABLE public.credit_wallets TO authenticated, service_role;
GRANT SELECT ON TABLE public.credit_transactions TO authenticated, service_role;
GRANT SELECT ON TABLE public.agent_runs TO authenticated, service_role;
GRANT SELECT ON TABLE public.ai_provider_usage TO authenticated, service_role;

-- Explicit function ACLs
REVOKE ALL ON FUNCTION public.record_ai_usage_and_deduct_credits(
    UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INT, INT, INT, NUMERIC, INT, INT, VARCHAR, JSONB, JSONB, TEXT
) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.select_preferred_niche(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_ai_usage_and_deduct_credits(
    UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, INT, INT, INT, NUMERIC, INT, INT, VARCHAR, JSONB, JSONB, TEXT
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.select_preferred_niche(UUID, UUID) TO authenticated, service_role;

COMMIT;
