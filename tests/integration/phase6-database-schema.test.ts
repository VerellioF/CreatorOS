import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 6 Database Schema, RLS & Stored Procedures Migration", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261031050000_phase6_publishing_and_saas_monetization.sql"
  );
  const typesPath = path.resolve(process.cwd(), "src/lib/supabase/types.ts");

  it("verifies migration file exists and defines all Phase 6 tables with 100% RLS", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Tables
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.saas_plans");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.subscriptions");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.payment_transactions");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.social_accounts");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.publishing_jobs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.publishing_logs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.system_settings");

    // Profile superadmin extension
    expect(sql).toContain("is_superadmin");

    // Credit transactions idempotency enhancement
    expect(sql).toContain("idempotency_key");

    // RLS Enforcement
    expect(sql).toContain("ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.publishing_logs ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;");

    // Constraints & Status checks
    expect(sql).toContain("check_subscriptions_status");
    expect(sql).toContain("check_payment_transactions_status");
    expect(sql).toContain("check_social_accounts_platform");
    expect(sql).toContain("check_publishing_jobs_status");
    expect(sql).toContain("check_publishing_logs_status");

    // Stored procedures
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.deduct_workspace_credits");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.refund_workspace_credits");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.allocate_workspace_credits");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.activate_subscription_payment");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_superadmin");
  });

  it("verifies TypeScript definitions in types.ts export Phase 6 table types", () => {
    const typesContent = fs.readFileSync(typesPath, "utf-8");
    expect(typesContent).toContain("saas_plans");
    expect(typesContent).toContain("subscriptions");
    expect(typesContent).toContain("payment_transactions");
    expect(typesContent).toContain("social_accounts");
    expect(typesContent).toContain("publishing_jobs");
    expect(typesContent).toContain("publishing_logs");
    expect(typesContent).toContain("system_settings");
    expect(typesContent).toContain("SaasPlanRow");
    expect(typesContent).toContain("SubscriptionRow");
    expect(typesContent).toContain("PaymentTransactionRow");
    expect(typesContent).toContain("SocialAccountRow");
    expect(typesContent).toContain("PublishingJobRow");
    expect(typesContent).toContain("PublishingLogRow");
    expect(typesContent).toContain("SystemSettingRow");
  });
});
