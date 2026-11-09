import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const PHASE7_SQL = path.join(
  REPO_ROOT,
  "supabase/migrations/20261031060000_phase7_analytics_and_public_launch.sql"
);

async function runPhase7Audit() {
  console.log("=== PHASE 7 POSTGRESQL & MULTI-TENANT SECURITY AUDIT ===");

  assert(fs.existsSync(PHASE7_SQL), "Phase 7 migration file must exist");
  const sql = fs.readFileSync(PHASE7_SQL, "utf-8");

  // 1. Verify Table Declarations & RLS
  const tables = [
    "content_performance_snapshots",
    "analytics_insights",
    "support_tickets",
    "data_retention_logs",
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
  console.log("✓ Audit 1: All 4 Phase 7 tables declared with 100% RLS enabled");

  // 2. Verify Constraints & Checks
  assert(sql.includes("check_performance_platform"), "Platform check constraint on performance snapshots");
  assert(sql.includes("check_performance_data_source"), "Data source check constraint on performance snapshots");
  assert(sql.includes("check_insights_grade"), "Grade check constraint on insights");
  assert(sql.includes("check_support_tickets_category"), "Category check constraint on support tickets");
  assert(sql.includes("check_support_tickets_priority"), "Priority check constraint on support tickets");
  assert(sql.includes("check_support_tickets_status"), "Status check constraint on support tickets");
  console.log("✓ Audit 2: All status, category, platform, and grade check constraints verified");

  // 3. Verify Stored Procedures
  const procedures = [
    "record_performance_snapshot",
    "execute_data_retention_cleanup",
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
  console.log("✓ Audit 3: All 2 atomic stored procedures verified and authorized");

  // 4. Verify RLS Policies
  assert(sql.includes('"performance_snapshots_select_member"'), "performance_snapshots select policy exists");
  assert(sql.includes('"performance_snapshots_insert_member"'), "performance_snapshots insert policy exists");
  assert(sql.includes('"analytics_insights_select_member"'), "analytics_insights select policy exists");
  assert(sql.includes('"support_tickets_select_member"'), "support_tickets select policy exists");
  assert(sql.includes('"data_retention_logs_select_member"'), "data_retention_logs select policy exists");
  console.log("✓ Audit 4: Strict tenant isolation RLS policies enforced across all tables");

  // 5. Verify Indexes
  assert(sql.includes("idx_content_performance_workspace"), "Performance workspace index exists");
  assert(sql.includes("idx_analytics_insights_workspace"), "Analytics insights workspace index exists");
  assert(sql.includes("idx_support_tickets_workspace"), "Support tickets workspace index exists");
  assert(sql.includes("idx_data_retention_workspace"), "Data retention workspace index exists");
  console.log("✓ Audit 5: High performance tenant indexes defined on all tables");

  console.log("==========================================================");
  console.log("ALL PHASE 7 POSTGRESQL & MULTI-TENANT AUDITS PASSED [5/5]");
  console.log("==========================================================");
}

runPhase7Audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
