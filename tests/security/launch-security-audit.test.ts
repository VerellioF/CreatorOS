import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SecurityAuditor } from "@/lib/security/security-auditor";

describe("Phase 7 Launch Readiness — Comprehensive Security Audit", () => {
  it("audits all SQL migration files and guarantees 100% RLS coverage", () => {
    const auditResult = SecurityAuditor.auditDatabaseMigrations();
    expect(auditResult.totalTables).toBeGreaterThan(15);
    expect(auditResult.unprotectedTables).toHaveLength(0);
    expect(auditResult.passed).toBe(true);
  });

  it("verifies environment variables and confirms zero client-exposed private keys", () => {
    const envAudit = SecurityAuditor.auditEnvironmentVariables();
    expect(envAudit.leakedSecrets).toHaveLength(0);
    expect(envAudit.passed).toBe(true);
  });

  it("verifies HTTP Security Headers configuration in next.config.ts", () => {
    const headersAudit = SecurityAuditor.auditSecurityHeaders();
    expect(headersAudit.missingHeaders).toHaveLength(0);
    expect(headersAudit.hasCSP).toBe(true);
    expect(headersAudit.hasHSTS).toBe(true);
    expect(headersAudit.hasXContentTypeOptions).toBe(true);
    expect(headersAudit.hasXFrameOptions).toBe(true);
    expect(headersAudit.passed).toBe(true);
  });
});
