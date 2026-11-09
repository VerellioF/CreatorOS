import { describe, it, expect, vi, beforeEach } from "vitest";
import { AdminService } from "@/services/admin-service";

describe("Phase 6 Superadmin Service & System Configuration", () => {
  const superadminId = "usr-superadmin-001";
  const regularUserId = "usr-regular-002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Admin Authorization Guards", () => {
    it("allows authorized superadmins to execute admin operations", async () => {
      AdminService.setMockSuperadmin(superadminId, true);
      const isSuper = await AdminService.isSuperadmin(superadminId);
      expect(isSuper).toBe(true);

      const health = await AdminService.getSystemHealth(superadminId);
      expect(health.status).toBe("healthy");
      expect(health.database).toBe("connected");
    });

    it("strictly blocks regular users from executing admin operations with 403 error", async () => {
      AdminService.setMockSuperadmin(regularUserId, false);
      const isSuper = await AdminService.isSuperadmin(regularUserId);
      expect(isSuper).toBe(false);

      await expect(
        AdminService.getSystemHealth(regularUserId)
      ).rejects.toThrow("Akses ditolak: Hanya Superadmin yang diizinkan mengakses portal ini.");
    });
  });

  describe("SaaS Plan Pricing & Limits Configuration", () => {
    it("dynamically updates plan pricing and limits from admin dashboard", async () => {
      const updated = await AdminService.updatePlanConfig(
        superadminId,
        "creator",
        {
          price_idr: 179000, // Updated price
          monthly_credits: 600, // Updated credits
        }
      );

      expect(updated.id).toBe("creator");
      expect(updated.price_idr).toBe(179000);
      expect(updated.monthly_credits).toBe(600);
    });
  });

  describe("Credit Management & Workspace Overrides", () => {
    it("adjusts workspace credit balance with admin attribution", async () => {
      const targetWorkspaceId = "ws-override-001";
      const adjustResult = await AdminService.adjustWorkspaceCredits(
        superadminId,
        targetWorkspaceId,
        100,
        "Admin Promotional Bonus Credits"
      );

      expect(adjustResult.status).toBe("success");
      expect(adjustResult.balance).toBeGreaterThanOrEqual(100);
    });
  });

  describe("AI Telemetry & Provider Management", () => {
    it("retrieves system-wide aggregated AI usage metrics and costs", async () => {
      const metrics = await AdminService.getSystemAiUsageMetrics(superadminId);
      expect(metrics.totalTokensUsed).toBeDefined();
      expect(metrics.totalCostUsd).toBeDefined();
      expect(metrics.providerBreakdown).toBeDefined();
      expect(metrics.providerBreakdown.gemini).toBeDefined();
    });

    it("updates provider configuration states and rate limits", async () => {
      const updated = await AdminService.updateProviderConfig(
        superadminId,
        "gemini",
        {
          enabled: true,
          default_model: "gemini-3.8-flash",
          rate_limit_rpm: 120,
        }
      );

      expect(updated.gemini.rate_limit_rpm).toBe(120);
    });
  });
});
