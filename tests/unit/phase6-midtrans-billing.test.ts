import { describe, it, expect, vi, beforeEach } from "vitest";
import { MidtransClient } from "@/lib/billing/midtrans-client";
import { BillingService } from "@/services/billing-service";
import crypto from "node:crypto";

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn(async () => true),
  },
}));

describe("Phase 6 Midtrans Payment Gateway & SaaS Billing", () => {
  const serverKey = "SB-Mid-server-TEST-KEY-12345";
  const workspaceId = "ws-billing-test-01";
  const userId = "usr-billing-test-01";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cryptographic Signature Verification", () => {
    it("generates and verifies valid SHA-512 signature for Midtrans webhook notification", () => {
      const orderId = "ORDER-CREATOROS-123456";
      const statusCode = "200";
      const grossAmount = "149000.00";

      const signatureKey = crypto
        .createHash("sha512")
        .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
        .digest("hex");

      const isValid = MidtransClient.verifySignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey,
        serverKey,
      });

      expect(isValid).toBe(true);
    });

    it("rejects tampered or forged webhook signatures", () => {
      const orderId = "ORDER-CREATOROS-123456";
      const statusCode = "200";
      const grossAmount = "149000.00";
      const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      const isValid = MidtransClient.verifySignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey: forgedSignature,
        serverKey,
      });

      expect(isValid).toBe(false);
    });
  });

  describe("Subscription Checkout Creation", () => {
    it("creates Midtrans Snap transaction for Creator Plan (Rp 149.000)", async () => {
      const checkout = await BillingService.createSubscriptionCheckout({
        workspaceId,
        userId,
        planTier: "creator",
        userEmail: "creator@example.com",
        userName: "Budi Creator",
      });

      expect(checkout.orderId).toContain("ORD_CREATOROS_");
      expect(checkout.planTier).toBe("creator");
      expect(checkout.grossAmount).toBe(149000);
      expect(checkout.snapToken).toBeDefined();
      expect(checkout.redirectUrl).toBeDefined();
    });

    it("supports Pro Plan (Rp 349.000) and Business Plan (Rp 899.000)", async () => {
      const proCheckout = await BillingService.createSubscriptionCheckout({
        workspaceId,
        userId,
        planTier: "pro",
      });
      expect(proCheckout.grossAmount).toBe(349000);

      const bizCheckout = await BillingService.createSubscriptionCheckout({
        workspaceId,
        userId,
        planTier: "business",
      });
      expect(bizCheckout.grossAmount).toBe(899000);
    });
  });

  describe("Server-Side Webhook Verification & Subscription Activation", () => {
    it("activates subscription for 30 days upon verified settlement webhook", async () => {
      const orderId = `ORD_CREATOROS_TEST_${Date.now()}`;
      const statusCode = "200";
      const grossAmount = "149000.00";
      const signatureKey = crypto
        .createHash("sha512")
        .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
        .digest("hex");

      // Setup pending checkout
      await BillingService.createSubscriptionCheckout({
        workspaceId,
        userId,
        planTier: "creator",
        customOrderId: orderId,
      });

      // Deliver webhook notification
      const result = await BillingService.handleMidtransWebhook({
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: "settlement",
        payment_type: "qris",
        serverKeyOverride: serverKey,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("activated");

      // Verify active subscription
      const sub = await BillingService.getWorkspaceSubscription(workspaceId, userId);
      expect(sub.planTier).toBe("creator");
      expect(sub.status).toBe("active");
      expect(new Date(sub.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());
    });

    it("refuses to activate subscription on frontend redirect without verified webhook", async () => {
      // Attempting client-side forced activation without server verification
      await expect(
        BillingService.activateSubscriptionDirectlyUnsafe({
          workspaceId,
          planTier: "pro",
        })
      ).rejects.toThrow("Aktivasi langganan dari frontend dilarang");
    });

    it("records expired payment when webhook reports expire status", async () => {
      const orderId = `ORD_CREATOROS_EXP_${Date.now()}`;
      const statusCode = "200";
      const grossAmount = "149000.00";
      const signatureKey = crypto
        .createHash("sha512")
        .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
        .digest("hex");

      await BillingService.createSubscriptionCheckout({
        workspaceId,
        userId,
        planTier: "creator",
        customOrderId: orderId,
      });

      const result = await BillingService.handleMidtransWebhook({
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: "expire",
        serverKeyOverride: serverKey,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("expired");
    });
  });

  describe("Payment History & Plans", () => {
    it("retrieves available configurable SaaS plans", async () => {
      const plans = await BillingService.getAvailablePlans();
      expect(plans.length).toBe(4);
      expect(plans.map((p) => p.id)).toEqual(["free", "creator", "pro", "business"]);
    });

    it("retrieves payment history for workspace", async () => {
      const history = await BillingService.getPaymentHistory(workspaceId, userId);
      expect(Array.isArray(history)).toBe(true);
    });
  });
});
