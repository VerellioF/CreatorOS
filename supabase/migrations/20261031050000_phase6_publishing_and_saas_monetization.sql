-- ==============================================================================
-- CREATOROS AI — PHASE 6 MIGRATION
-- Module: Publishing Center, SaaS Monetization, Midtrans Billing, Credits & Admin
-- Strict Multi-Tenant Isolation, 100% RLS Coverage, Idempotency & Concurrency Safety
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND EXISTING TABLES: profiles & credit_transactions
-- ------------------------------------------------------------------------------

-- Add is_superadmin flag to profiles for secure administrative authorization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'is_superadmin'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_superadmin BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Add idempotency_key and user_id to credit_transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.credit_transactions ADD COLUMN idempotency_key TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_transactions' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.credit_transactions ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TABLE: saas_plans
-- Configurable SaaS subscription plans (Free, Creator, Pro, Business)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id VARCHAR(30) PRIMARY KEY,
    name TEXT NOT NULL,
    price_idr INT NOT NULL,
    monthly_credits INT NOT NULL,
    max_workspaces INT NOT NULL,
    max_members_per_workspace INT NOT NULL,
    max_storage_mb INT NOT NULL,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_saas_plans_id CHECK (id IN ('free', 'creator', 'pro', 'business')),
    CONSTRAINT check_saas_plans_price CHECK (price_idr >= 0),
    CONSTRAINT check_saas_plans_credits CHECK (monthly_credits >= 0)
);

ALTER TABLE public.saas_plans OWNER TO postgres;

-- Seed default configurable plans
INSERT INTO public.saas_plans (id, name, price_idr, monthly_credits, max_workspaces, max_members_per_workspace, max_storage_mb, features, is_active)
VALUES
    ('free', 'Free Starter', 0, 50, 1, 1, 500, '["basic_ai", "single_channel_publish", "manual_export"]'::jsonb, TRUE),
    ('creator', 'Creator Pro', 149000, 500, 3, 3, 5000, '["advanced_ai", "all_channels_publish", "batch_scheduler", "voice_synthesis"]'::jsonb, TRUE),
    ('pro', 'Professional Studio', 349000, 2000, 10, 10, 25000, '["unlimited_agents", "team_collaboration", "priority_render", "custom_dna"]'::jsonb, TRUE),
    ('business', 'Enterprise / Agency', 899000, 6000, 50, 50, 100000, '["white_label_export", "dedicated_queue", "sla_support", "custom_integrations"]'::jsonb, TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_idr = EXCLUDED.price_idr,
    monthly_credits = EXCLUDED.monthly_credits,
    max_workspaces = EXCLUDED.max_workspaces,
    max_members_per_workspace = EXCLUDED.max_members_per_workspace,
    max_storage_mb = EXCLUDED.max_storage_mb,
    features = EXCLUDED.features;

-- ------------------------------------------------------------------------------
-- 3. TABLE: subscriptions
-- Active SaaS subscription per workspace
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
    plan_tier VARCHAR(30) REFERENCES public.saas_plans(id) DEFAULT 'free' NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'monthly' NOT NULL,
    current_period_start TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_subscriptions_status CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    CONSTRAINT check_subscriptions_cycle CHECK (billing_cycle IN ('monthly', 'yearly'))
);

ALTER TABLE public.subscriptions OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 4. TABLE: payment_transactions
-- Midtrans payment audit trail and verification records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id TEXT NOT NULL UNIQUE,
    plan_tier VARCHAR(30) REFERENCES public.saas_plans(id) NOT NULL,
    gross_amount NUMERIC(12,2) NOT NULL,
    payment_type VARCHAR(50),
    transaction_status VARCHAR(30) DEFAULT 'pending' NOT NULL,
    fraud_status VARCHAR(30),
    snap_token TEXT,
    snap_redirect_url TEXT,
    midtrans_response JSONB,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_payment_transactions_status CHECK (
        transaction_status IN ('pending', 'settlement', 'capture', 'deny', 'expire', 'cancel', 'refund')
    ),
    CONSTRAINT check_payment_transactions_amount CHECK (gross_amount >= 0)
);

ALTER TABLE public.payment_transactions OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 5. TABLE: social_accounts
-- Connected publisher credentials, official OAuth tokens & capability profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    platform VARCHAR(30) NOT NULL,
    account_name TEXT NOT NULL,
    account_id TEXT NOT NULL,
    avatar_url TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'connected' NOT NULL,
    last_error TEXT,
    connected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_social_accounts_platform CHECK (
        platform IN ('tiktok', 'instagram', 'youtube', 'facebook', 'shopee')
    ),
    CONSTRAINT check_social_accounts_status CHECK (
        status IN ('connected', 'expired', 'disconnected', 'error')
    ),
    CONSTRAINT unique_workspace_platform_account UNIQUE (workspace_id, platform, account_id)
);

ALTER TABLE public.social_accounts OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 6. TABLE: publishing_jobs
-- Social media publishing jobs (direct upload, scheduling, or manual fallback)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    content_item_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
    social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
    platform VARCHAR(30) NOT NULL,
    title TEXT NOT NULL,
    caption TEXT,
    media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
    media_url TEXT,
    status VARCHAR(30) DEFAULT 'draft' NOT NULL,
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 3 NOT NULL,
    external_post_id TEXT,
    external_post_url TEXT,
    error_message TEXT,
    manual_export_data JSONB,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_publishing_jobs_platform CHECK (
        platform IN ('tiktok', 'instagram', 'youtube', 'facebook', 'shopee')
    ),
    CONSTRAINT check_publishing_jobs_status CHECK (
        status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'manual_export_ready')
    ),
    CONSTRAINT check_publishing_jobs_attempts CHECK (attempts >= 0 AND max_attempts > 0)
);

ALTER TABLE public.publishing_jobs OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 7. TABLE: publishing_logs
-- Granular audit trails for every publishing activity and status update
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.publishing_logs (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    job_id UUID REFERENCES public.publishing_jobs(id) ON DELETE CASCADE NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    action VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL,
    CONSTRAINT check_publishing_logs_status CHECK (
        status IN ('info', 'success', 'warning', 'error')
    )
);

ALTER TABLE public.publishing_logs OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 8. TABLE: system_settings
-- System-wide admin key-value configurations (providers, maintenance, defaults)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(80) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT pg_catalog.now() NOT NULL
);

ALTER TABLE public.system_settings OWNER TO postgres;

-- Seed default system provider configuration
INSERT INTO public.system_settings (key, value, description)
VALUES
    ('providers_config', '{
        "gemini": { "enabled": true, "default_model": "gemini-3.8-flash", "rate_limit_rpm": 60 },
        "openai": { "enabled": true, "default_model": "gpt-4o", "rate_limit_rpm": 40 },
        "elevenlabs": { "enabled": true, "rate_limit_rpm": 30 },
        "runway": { "enabled": true, "rate_limit_rpm": 10 }
    }'::jsonb, 'Global AI provider states and rate limits'),
    ('system_health', '{
        "maintenance_mode": false,
        "allow_new_registrations": true,
        "allow_payments": true
    }'::jsonb, 'System operational flags and kill-switches')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subscriptions_ws ON public.subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_ws ON public.payment_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_ws ON public.social_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON public.social_accounts(workspace_id, platform);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_ws ON public.publishing_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_status ON public.publishing_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_publishing_logs_job ON public.publishing_logs(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_idempotency ON public.credit_transactions(idempotency_key);

-- ------------------------------------------------------------------------------
-- 10. HELPER FUNCTIONS & ATOMIC STORED PROCEDURES
-- ------------------------------------------------------------------------------

-- Superadmin authorization helper
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT p.is_superadmin FROM public.profiles p WHERE p.id = user_id),
        FALSE
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin TO authenticated, service_role;

-- Atomic credit deduction with idempotency control and row-level locking
CREATE OR REPLACE FUNCTION public.deduct_workspace_credits(
    p_workspace_id UUID,
    p_amount INT,
    p_description TEXT,
    p_idempotency_key TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wallet_id UUID;
    v_balance INT;
    v_new_balance INT;
    v_existing_tx RECORD;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid deduction amount: must be greater than 0.';
    END IF;

    -- Check idempotency: if transaction with this key exists, return early
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, amount, balance_after INTO v_existing_tx
        FROM public.credit_transactions
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'status', 'idempotent_duplicate',
                'transaction_id', v_existing_tx.id,
                'deducted', -v_existing_tx.amount,
                'balance', v_existing_tx.balance_after
            );
        END IF;
    END IF;

    -- Acquire Level 4 row lock on wallet
    SELECT id, balance INTO v_wallet_id, v_balance
    FROM public.credit_wallets
    WHERE workspace_id = p_workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace credit wallet not found for %', p_workspace_id;
    END IF;

    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient workspace credits: required %, available %.', p_amount, v_balance;
    END IF;

    v_new_balance := v_balance - p_amount;

    UPDATE public.credit_wallets
    SET balance = v_new_balance,
        updated_at = pg_catalog.now()
    WHERE id = v_wallet_id;

    INSERT INTO public.credit_transactions (
        wallet_id,
        user_id,
        amount,
        balance_after,
        transaction_type,
        reference_id,
        idempotency_key,
        description,
        created_at
    )
    VALUES (
        v_wallet_id,
        p_user_id,
        -p_amount,
        v_new_balance,
        'ai_generation',
        p_reference_id,
        p_idempotency_key,
        COALESCE(p_description, 'Credit deduction'),
        pg_catalog.now()
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'deducted', p_amount,
        'balance', v_new_balance
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deduct_workspace_credits TO authenticated, service_role;

-- Atomic credit refund with idempotency
CREATE OR REPLACE FUNCTION public.refund_workspace_credits(
    p_workspace_id UUID,
    p_amount INT,
    p_reason TEXT,
    p_idempotency_key TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wallet_id UUID;
    v_balance INT;
    v_new_balance INT;
    v_existing_tx RECORD;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid refund amount: must be greater than 0.';
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, amount, balance_after INTO v_existing_tx
        FROM public.credit_transactions
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'status', 'idempotent_duplicate',
                'transaction_id', v_existing_tx.id,
                'refunded', v_existing_tx.amount,
                'balance', v_existing_tx.balance_after
            );
        END IF;
    END IF;

    SELECT id, balance INTO v_wallet_id, v_balance
    FROM public.credit_wallets
    WHERE workspace_id = p_workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace credit wallet not found for %', p_workspace_id;
    END IF;

    v_new_balance := v_balance + p_amount;

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
        idempotency_key,
        description,
        created_at
    )
    VALUES (
        v_wallet_id,
        p_amount,
        v_new_balance,
        'refund',
        p_reference_id,
        p_idempotency_key,
        COALESCE(p_reason, 'Credit refund for failed operation'),
        pg_catalog.now()
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'refunded', p_amount,
        'balance', v_new_balance
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_workspace_credits TO authenticated, service_role;

-- Credit allocation function (e.g., plan grant or top-up)
CREATE OR REPLACE FUNCTION public.allocate_workspace_credits(
    p_workspace_id UUID,
    p_amount INT,
    p_type TEXT DEFAULT 'top_up',
    p_idempotency_key TEXT DEFAULT NULL,
    p_description TEXT DEFAULT 'Credit allocation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_wallet_id UUID;
    v_balance INT;
    v_new_balance INT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid allocation amount: must be greater than 0.';
    END IF;

    SELECT id, balance INTO v_wallet_id, v_balance
    FROM public.credit_wallets
    WHERE workspace_id = p_workspace_id
    FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.credit_wallets (workspace_id, balance, monthly_allowance)
        VALUES (p_workspace_id, p_amount, p_amount)
        RETURNING id, balance INTO v_wallet_id, v_new_balance;
    ELSE
        v_new_balance := v_balance + p_amount;
        UPDATE public.credit_wallets
        SET balance = v_new_balance,
            monthly_allowance = CASE WHEN p_type = 'monthly_grant' THEN p_amount ELSE monthly_allowance END,
            updated_at = pg_catalog.now()
        WHERE id = v_wallet_id;
    END IF;

    INSERT INTO public.credit_transactions (
        wallet_id,
        amount,
        balance_after,
        transaction_type,
        idempotency_key,
        description,
        created_at
    )
    VALUES (
        v_wallet_id,
        p_amount,
        v_new_balance,
        p_type,
        p_idempotency_key,
        p_description,
        pg_catalog.now()
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'allocated', p_amount,
        'balance', v_new_balance
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_workspace_credits TO authenticated, service_role;

-- Atomic Midtrans settlement & subscription activation
CREATE OR REPLACE FUNCTION public.activate_subscription_payment(
    p_order_id TEXT,
    p_midtrans_status TEXT,
    p_payment_type TEXT,
    p_raw_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment RECORD;
    v_plan RECORD;
    v_period_start TIMESTAMPTZ := pg_catalog.now();
    v_period_end TIMESTAMPTZ := pg_catalog.now() + INTERVAL '30 days';
BEGIN
    SELECT * INTO v_payment
    FROM public.payment_transactions
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment transaction not found for order_id: %', p_order_id;
    END IF;

    -- Update transaction record
    UPDATE public.payment_transactions
    SET transaction_status = p_midtrans_status,
        payment_type = COALESCE(p_payment_type, payment_type),
        midtrans_response = p_raw_payload,
        settled_at = CASE WHEN p_midtrans_status IN ('settlement', 'capture') THEN pg_catalog.now() ELSE settled_at END,
        updated_at = pg_catalog.now()
    WHERE id = v_payment.id;

    -- Only activate subscription and allocate credits on valid settlement or captured payment
    IF p_midtrans_status IN ('settlement', 'capture') THEN
        SELECT * INTO v_plan
        FROM public.saas_plans
        WHERE id = v_payment.plan_tier;

        -- Upsert subscription
        INSERT INTO public.subscriptions (
            workspace_id,
            plan_tier,
            status,
            billing_cycle,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            updated_at
        )
        VALUES (
            v_payment.workspace_id,
            v_payment.plan_tier,
            'active',
            'monthly',
            v_period_start,
            v_period_end,
            FALSE,
            pg_catalog.now()
        )
        ON CONFLICT (workspace_id) DO UPDATE SET
            plan_tier = EXCLUDED.plan_tier,
            status = 'active',
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            cancel_at_period_end = FALSE,
            updated_at = pg_catalog.now();

        -- Allocate plan monthly credits with idempotency
        IF v_plan.monthly_credits > 0 THEN
            PERFORM public.allocate_workspace_credits(
                v_payment.workspace_id,
                v_plan.monthly_credits,
                'monthly_grant',
                'sub_grant_' || p_order_id,
                'Monthly plan credits grant: ' || v_plan.name
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'order_id', p_order_id,
        'transaction_status', p_midtrans_status,
        'plan_tier', v_payment.plan_tier
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_subscription_payment TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (100% COVERAGE)
-- ------------------------------------------------------------------------------
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- saas_plans: Publicly readable by all authenticated users, editable only by superadmins
DROP POLICY IF EXISTS "saas_plans_select_all" ON public.saas_plans;
CREATE POLICY "saas_plans_select_all" ON public.saas_plans
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "saas_plans_admin_manage" ON public.saas_plans;
CREATE POLICY "saas_plans_admin_manage" ON public.saas_plans
    FOR ALL TO authenticated USING (public.is_superadmin());

-- subscriptions: Visible to workspace members or superadmins
DROP POLICY IF EXISTS "subscriptions_select_member" ON public.subscriptions;
CREATE POLICY "subscriptions_select_member" ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'viewer')
        OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "subscriptions_admin_manage" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_manage" ON public.subscriptions
    FOR ALL TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'admin')
        OR public.is_superadmin()
    );

-- payment_transactions: Visible to workspace members or superadmins
DROP POLICY IF EXISTS "payment_transactions_select_member" ON public.payment_transactions;
CREATE POLICY "payment_transactions_select_member" ON public.payment_transactions
    FOR SELECT TO authenticated
    USING (
        public.has_workspace_access(workspace_id, 'viewer')
        OR public.is_superadmin()
    );

-- social_accounts: Workspace isolation (admin/editor can modify, viewer can see)
DROP POLICY IF EXISTS "social_accounts_select_member" ON public.social_accounts;
CREATE POLICY "social_accounts_select_member" ON public.social_accounts
    FOR SELECT TO authenticated
    USING (public.has_workspace_access(workspace_id, 'viewer') OR public.is_superadmin());

DROP POLICY IF EXISTS "social_accounts_manage_editor" ON public.social_accounts;
CREATE POLICY "social_accounts_manage_editor" ON public.social_accounts
    FOR ALL TO authenticated
    USING (public.has_workspace_access(workspace_id, 'editor') OR public.is_superadmin());

-- publishing_jobs: Workspace isolation
DROP POLICY IF EXISTS "publishing_jobs_select_member" ON public.publishing_jobs;
CREATE POLICY "publishing_jobs_select_member" ON public.publishing_jobs
    FOR SELECT TO authenticated
    USING (public.has_workspace_access(workspace_id, 'viewer') OR public.is_superadmin());

DROP POLICY IF EXISTS "publishing_jobs_manage_editor" ON public.publishing_jobs;
CREATE POLICY "publishing_jobs_manage_editor" ON public.publishing_jobs
    FOR ALL TO authenticated
    USING (public.has_workspace_access(workspace_id, 'editor') OR public.is_superadmin());

-- publishing_logs: Workspace isolation
DROP POLICY IF EXISTS "publishing_logs_select_member" ON public.publishing_logs;
CREATE POLICY "publishing_logs_select_member" ON public.publishing_logs
    FOR SELECT TO authenticated
    USING (public.has_workspace_access(workspace_id, 'viewer') OR public.is_superadmin());

DROP POLICY IF EXISTS "publishing_logs_insert_editor" ON public.publishing_logs;
CREATE POLICY "publishing_logs_insert_editor" ON public.publishing_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.has_workspace_access(workspace_id, 'editor') OR public.is_superadmin());

-- system_settings: Visible to authenticated users, editable only by superadmins
DROP POLICY IF EXISTS "system_settings_select_all" ON public.system_settings;
CREATE POLICY "system_settings_select_all" ON public.system_settings
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "system_settings_admin_manage" ON public.system_settings;
CREATE POLICY "system_settings_admin_manage" ON public.system_settings
    FOR ALL TO authenticated USING (public.is_superadmin());

-- Grants
GRANT SELECT ON TABLE public.saas_plans TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.subscriptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_transactions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_accounts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.publishing_jobs TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.publishing_logs TO authenticated, service_role;
GRANT SELECT ON TABLE public.system_settings TO authenticated, service_role;
