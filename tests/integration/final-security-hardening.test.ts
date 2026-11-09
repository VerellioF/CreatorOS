import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// ==============================================================================
// CREATOROS PHASE 1 — STATIC MIGRATION INVARIANT AUDIT (VITEST GATE)
// Companion to the real PostgreSQL multi-connection test runner in:
//   - supabase/tests/run_real_postgres_audit.mjs
//   - supabase/tests/security_hardening_audit.sql
// ==============================================================================

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "supabase/migrations/20261030000000_phase1_foundation.sql"
);

describe("Phase 1 Migration SQL — Final Security & Concurrency Audit Invariants", () => {
  const sql = fs.readFileSync(MIGRATION_FILE, "utf8");
  const codeOnly = sql.replace(/--.*$/gm, "");

  it("1. Eliminates invalid pg_catalog.current_user, CURRENT_USER bypasses, and invalid pg_catalog string calls", () => {
    expect(sql).not.toMatch(/pg_catalog\.current_user/i);
    expect(codeOnly).not.toMatch(/current_user/i);
    expect(codeOnly).not.toMatch(/pg_catalog\.trim\s*\(/i);
    expect(codeOnly).not.toMatch(/pg_catalog\.substring\s*\(/i);
  });

  it("2. Eliminates spoofable custom GUCs and enforces atomic single-use xid8 token consumption", () => {
    expect(codeOnly).not.toContain("creatoros.internal_operation");
    expect(codeOnly).not.toContain("creatoros.ownership_transfer_active");
    expect(codeOnly).not.toMatch(/set_config\s*\(\s*'creatoros\./i);
    expect(codeOnly).not.toMatch(/current_setting\s*\(\s*'creatoros\./i);

    expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS creatoros_internal;");
    expect(sql).toContain("REVOKE ALL ON SCHEMA creatoros_internal FROM PUBLIC, anon, authenticated, service_role;");
    expect(codeOnly).toContain("expected_tg_op");
    expect(codeOnly).toContain("expected_old_role");
    expect(codeOnly).toContain("expected_new_role");
    expect(codeOnly).toContain("DELETE FROM creatoros_internal.trusted_operations");
    expect(codeOnly).toContain("RETURNING op_type, actor_user_id INTO v_op_type, v_token_actor_id;");
  });

  it("3. Enforces RPC-only membership mutations and canonical Level 1 -> Level 2 lock hierarchy", () => {
    expect(codeOnly).toContain("creatoros_internal.lock_workspace_boundary");
    expect(codeOnly).toContain("creatoros_internal.workspace_locks");
    expect(codeOnly).toContain("GRANT SELECT ON TABLE public.workspace_members TO authenticated;");
    expect(codeOnly).not.toMatch(/GRANT\s+[^;]*INSERT[^;]*ON\s+TABLE\s+public\.workspace_members/i);
    expect(codeOnly).not.toMatch(/GRANT\s+[^;]*UPDATE[^;]*ON\s+TABLE\s+public\.workspace_members/i);
    expect(codeOnly).not.toMatch(/GRANT\s+[^;]*DELETE[^;]*ON\s+TABLE\s+public\.workspace_members/i);

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.add_workspace_member(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.update_workspace_member_role(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.remove_workspace_member(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(");
  });

  it("4. Enforces personal owned workspace invariant, INSERT-time slug collision retry, and account deletion guard", () => {
    expect(codeOnly).not.toMatch(/ON\s+CONFLICT\s*\(\s*slug\s*\)\s+DO\s+NOTHING/i);
    expect(codeOnly).toMatch(/EXCEPTION\s+WHEN\s+unique_violation\s+THEN/i);
    expect(codeOnly).toMatch(/AND\s+wm\.role\s*=\s*'owner'/i);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()");
    expect(sql).toContain("FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL");
  });

  it("5. Enforces SET search_path = '', OWNER TO postgres, and zero client EXECUTE on internal/trigger functions", () => {
    expect(sql).toContain("ALTER FUNCTION public.has_workspace_access(UUID, VARCHAR) OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.is_workspace_creator_during_insert(UUID, UUID) OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.enforce_workspace_member_safety() OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.add_workspace_member(UUID, UUID, VARCHAR) OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.update_workspace_member_role(UUID, UUID, VARCHAR) OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.remove_workspace_member(UUID, UUID) OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.transfer_workspace_ownership(UUID, UUID) OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.handle_new_workspace() OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.handle_new_user() OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.handle_auth_user_deletion() OWNER TO postgres;");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.enforce_workspace_member_safety() FROM PUBLIC, anon, authenticated, service_role;");
  });

  it("6. Enables RLS on all 4 public tables, enforces soft-delete & URL XSS checks, and locks PUBLIC/anon object privileges", () => {
    expect(sql).toContain("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("check_profiles_avatar_url");
    expect(sql).toContain("check_workspaces_logo_url");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.update_workspace_configuration(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.soft_delete_workspace(");
    expect(sql).toContain("ALTER FUNCTION public.update_workspace_configuration(UUID, TEXT, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, BOOLEAN) OWNER TO postgres;");
    expect(sql).toContain("ALTER FUNCTION public.soft_delete_workspace(UUID) OWNER TO postgres;");
    expect(sql).toContain("REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;");
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;");
  });
});
