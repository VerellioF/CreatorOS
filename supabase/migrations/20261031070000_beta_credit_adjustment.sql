-- ==============================================================================
-- MIGRATION: 20261031070000_beta_credit_adjustment.sql
-- DESCRIPTION: Sets default workspace credit balance and monthly allowance to 20 for Public Beta
-- ==============================================================================

-- Adjust defaults on credit_wallets
ALTER TABLE IF EXISTS credit_wallets 
    ALTER COLUMN balance SET DEFAULT 20,
    ALTER COLUMN monthly_allowance SET DEFAULT 20;

-- Update workspace creation trigger function to grant 20 beta credits
CREATE OR REPLACE FUNCTION initialize_workspace_credit_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO credit_wallets (workspace_id, balance, monthly_allowance)
    VALUES (NEW.id, 20, 20)
    ON CONFLICT (workspace_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
