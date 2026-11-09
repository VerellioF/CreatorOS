import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 7 Database Schema, RLS & Stored Procedures Migration", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261031060000_phase7_analytics_and_public_launch.sql"
  );
  const typesPath = path.resolve(process.cwd(), "src/lib/supabase/types.ts");

  it("verifies migration file exists and defines all Phase 7 tables with 100% RLS", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Tables
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.content_performance_snapshots");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.analytics_insights");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.support_tickets");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.data_retention_logs");

    // RLS Enforcement
    expect(sql).toContain("ALTER TABLE public.content_performance_snapshots ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.analytics_insights ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;");
    expect(sql).toContain("ALTER TABLE public.data_retention_logs ENABLE ROW LEVEL SECURITY;");

    // Constraints & Status checks
    expect(sql).toContain("check_performance_platform");
    expect(sql).toContain("check_performance_data_source");
    expect(sql).toContain("check_insights_grade");
    expect(sql).toContain("check_support_tickets_category");
    expect(sql).toContain("check_support_tickets_priority");
    expect(sql).toContain("check_support_tickets_status");

    // Stored procedures
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.record_performance_snapshot");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.execute_data_retention_cleanup");
  });

  it("verifies TypeScript definitions in types.ts export Phase 7 table types", () => {
    const typesContent = fs.readFileSync(typesPath, "utf-8");
    expect(typesContent).toContain("content_performance_snapshots");
    expect(typesContent).toContain("analytics_insights");
    expect(typesContent).toContain("support_tickets");
    expect(typesContent).toContain("data_retention_logs");
    expect(typesContent).toContain("ContentPerformanceSnapshotRow");
    expect(typesContent).toContain("AnalyticsInsightRow");
    expect(typesContent).toContain("SupportTicketRow");
    expect(typesContent).toContain("DataRetentionLogRow");
  });
});
