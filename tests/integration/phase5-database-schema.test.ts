import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 5 Database Schema & Multi-Tenant Migration", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261031040000_phase5_ai_agents_and_automation.sql"
  );
  const typesPath = path.resolve(process.cwd(), "src/lib/supabase/types.ts");

  it("verifies migration file exists and defines all 4 workflow tables with 100% RLS", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Tables
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.workflow_runs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.workflow_steps");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.workflow_schedules");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.workflow_logs");

    // Status constraints
    expect(sql).toContain("check_workflow_runs_status");
    expect(sql).toContain("waiting_approval");
    expect(sql).toContain("check_workflow_steps_status");
    expect(sql).toContain("requires_approval");

    // RLS Enforcement
    expect(sql).toContain("ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.workflow_schedules ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;");

    // Autonomous turn limit guardrail (max 5 turns)
    expect(sql).toContain("check_workflow_schedules_max_turns");

    // Atomic stored procedures
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.advance_workflow_step");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.approve_workflow_step");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.cancel_workflow_run");
  });

  it("verifies TypeScript definitions in types.ts export workflow table types", () => {
    const typesContent = fs.readFileSync(typesPath, "utf-8");
    expect(typesContent).toContain("workflow_runs");
    expect(typesContent).toContain("workflow_steps");
    expect(typesContent).toContain("workflow_schedules");
    expect(typesContent).toContain("workflow_logs");
    expect(typesContent).toContain("WorkflowRunRow");
    expect(typesContent).toContain("WorkflowStepRow");
    expect(typesContent).toContain("WorkflowScheduleRow");
    expect(typesContent).toContain("WorkflowLogRow");
  });
});
