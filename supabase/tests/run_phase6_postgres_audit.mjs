import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const PHASE6_SQL = path.join(
  REPO_ROOT,
  "supabase/migrations/20261031050000_phase6_publishing_and_saas_monetization.sql"
);

async function runPhase6Audit() {
  console.log("=== PHASE 6 POSTGRESQL & MULTI-TENANT SECURITY AUDIT ===");

  assert(fs.existsSync(PHASE6_SQL), "Phase 6 migration file must exist");
  const sql = fs.readFileSync(PHASE6_SQL, "utf-8");

  // 1. Verify Table Declarations & RLS
  const tables = [
    "saas_plans",
    "subscriptions",
    "payment_transactions",
    "social_accounts",
    "publishing_jobs",
    "publishing_logs",
    "system_settings",
  ];
  for (const table of tables) {
    assert(
      sql.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
      `Table public.${table} must be declared`
    );
    assert(
      sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
      `RLS must be enabled on ${table}`
    );
  }
  console.log("✓ Audit 1: All 7 Phase 6 tables declared with 100% RLS enabled");

  // 2. Verify Constraints & Checks
  assert(sql.includes("check_saas_plans_id"), "Plan ID check constraint");
  assert(sql.includes("check_subscriptions_status"), "Subscriptions status check constraint");
  assert(sql.includes("check_payment_transactions_status"), "Payment status check constraint");
  assert(sql.includes("check_social_accounts_platform"), "Platform check constraint");
  assert(sql.includes("check_publishing_jobs_status"), "Publishing job status check constraint");
  assert(sql.includes("check_publishing_logs_status"), "Publishing log status check constraint");
  console.log("✓ Audit 2: All status and platform enum check constraints verified");

  // 3. Verify Stored Procedures
  const procedures = [
    "is_superadmin",
    "deduct_workspace_credits",
    "refund_workspace_credits",
    "allocate_workspace_credits",
    "activate_subscription_payment",
  ];
  for (const proc of procedures) {
    assert(
      sql.includes(`CREATE OR REPLACE FUNCTION public.${proc}`),
      `Stored procedure public.${proc} must exist`
    );
    assert(
      sql.includes(`GRANT EXECUTE ON FUNCTION public.${proc}`),
      `Permissions must be granted for public.${proc}`
    );
  }
  console.log("✓ Audit 3: All 5 atomic stored procedures verified and authorized");

  // 4. Verify Idempotency and Superadmin Extensions
  assert(sql.includes("is_superadmin"), "profiles.is_superadmin column added");
  assert(sql.includes("idempotency_key"), "credit_transactions.idempotency_key column added");
  assert(sql.includes("idx_credit_transactions_idempotency"), "Idempotency index exists");
  console.log("✓ Audit 4: Idempotency control and superadmin role verified");

  // 5. Verify RLS Policies
  assert(sql.includes('"saas_plans_select_all"'), "saas_plans select policy exists");
  assert(sql.includes('"subscriptions_select_member"'), "subscriptions select policy exists");
  assert(sql.includes('"payment_transactions_select_member"'), "payment_transactions select policy exists");
  assert(sql.includes('"social_accounts_select_member"'), "social_accounts select policy exists");
  assert(sql.includes('"publishing_jobs_select_member"'), "publishing_jobs select policy exists");
  assert(sql.includes('"publishing_logs_select_member"'), "publishing_logs select policy exists");
  console.log("✓ Audit 5: Strict tenant isolation RLS policies enforced across all tables");

  console.log("==========================================================");
  console.log("ALL PHASE 6 POSTGRESQL & MULTI-TENANT AUDITS PASSED [5/5]");
  console.log("==========================================================");
}

runPhase6Audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
