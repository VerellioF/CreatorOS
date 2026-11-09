import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditService } from "@/services/credit-service";
import { InsufficientCreditsError } from "@/lib/ai/types";

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn(async () => true),
  },
}));

describe("Phase 6 Credit Management System — Atomic Operations & Idempotency", () => {
  const workspaceId = "ws-credit-test-001";
  const userId = "usr-credit-test-001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Credit Allocation", () => {
    it("allocates subscription monthly grant credits and records transaction", async () => {
      const result = await CreditService.allocateCredits({
        workspaceId,
        amount: 500,
        type: "monthly_grant",
        idempotencyKey: "alloc_sub_001",
        description: "Monthly Creator Plan Credits",
      });

      expect(result.status).toBe("success");
      expect(result.allocated).toBe(500);
      expect(result.balance).toBeGreaterThanOrEqual(500);
    });
  });

  describe("Atomic Deductions & Idempotency Controls", () => {
    it("atomically deducts credits with balance update", async () => {
      const initialBalance = await CreditService.getBalance(workspaceId, userId);
      const deductResult = await CreditService.deductCredits({
        workspaceId,
        userId,
        amount: 10,
        description: "AI Video Generation Render",
        idempotencyKey: "deduct_job_render_001",
      });

      expect(deductResult.status).toBe("success");
      expect(deductResult.deducted).toBe(10);
      expect(deductResult.balance).toBe(initialBalance - 10);
    });

    it("prevents duplicate credit deductions using strict idempotency key", async () => {
      const balanceBefore = await CreditService.getBalance(workspaceId, userId);
      const idempotencyKey = "deduct_unique_render_dup_test";

      // First call
      const firstCall = await CreditService.deductCredits({
        workspaceId,
        userId,
        amount: 5,
        description: "Scene generation",
        idempotencyKey,
      });

      // Immediate retry of identical operation (e.g., network retry / re-render)
      const secondCall = await CreditService.deductCredits({
        workspaceId,
        userId,
        amount: 5,
        description: "Scene generation",
        idempotencyKey,
      });

      expect(secondCall.status).toBe("idempotent_duplicate");
      expect(secondCall.balance).toBe(firstCall.balance); // Did not double-deduct!

      const finalBalance = await CreditService.getBalance(workspaceId, userId);
      expect(finalBalance).toBe(balanceBefore - 5);
    });

    it("rejects deduction when workspace credit balance is insufficient", async () => {
      await expect(
        CreditService.deductCredits({
          workspaceId,
          userId,
          amount: 999999, // Exceeds balance
          description: "Impossible generation",
          idempotencyKey: "deduct_excessive",
        })
      ).rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe("Credit Refunds for Eligible Failed Operations", () => {
    it("refunds credits when a media render or publishing job fails", async () => {
      const idempotencyKey = "refund_failed_render_001";
      const balanceBefore = await CreditService.getBalance(workspaceId, userId);

      const refundResult = await CreditService.refundCredits({
        workspaceId,
        amount: 15,
        reason: "Background FFmpeg video render pipeline failed",
        idempotencyKey,
      });

      expect(refundResult.status).toBe("success");
      expect(refundResult.refunded).toBe(15);
      expect(refundResult.balance).toBe(balanceBefore + 15);
    });

    it("prevents duplicate refunds using idempotency key", async () => {
      const idempotencyKey = "refund_failed_render_dup_test";
      const firstRefund = await CreditService.refundCredits({
        workspaceId,
        amount: 10,
        reason: "Publishing timeout",
        idempotencyKey,
      });

      const secondRefund = await CreditService.refundCredits({
        workspaceId,
        amount: 10,
        reason: "Publishing timeout retry",
        idempotencyKey,
      });

      expect(secondRefund.status).toBe("idempotent_duplicate");
      expect(secondRefund.balance).toBe(firstRefund.balance);
    });
  });

  describe("User & Workspace Limits Enforcements", () => {
    it("enforces per-user monthly usage caps if configured", async () => {
      const check = await CreditService.enforceLimits({
        workspaceId,
        userId,
        operationCost: 5,
        userMonthlyLimit: 100,
        currentUserMonthlyUsage: 98,
      });
      // 98 + 5 = 103 > 100
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("Batas kuota kredit bulanan pengguna tercapai");
    });

    it("allows operations within workspace and user limits", async () => {
      const check = await CreditService.enforceLimits({
        workspaceId,
        userId,
        operationCost: 5,
        userMonthlyLimit: 100,
        currentUserMonthlyUsage: 20,
      });
      expect(check.allowed).toBe(true);
    });
  });

  describe("Usage History & Cost Ledger", () => {
    it("retrieves paginated credit transactions ledger with attribution", async () => {
      const history = await CreditService.getCreditHistory(workspaceId, userId);
      expect(Array.isArray(history.transactions)).toBe(true);
      expect(history.transactions.length).toBeGreaterThan(0);
      expect(history.balance).toBeDefined();
    });
  });
});
