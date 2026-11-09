import { describe, it, expect, vi } from "vitest";
import { POST as webhookPost } from "@/app/api/webhooks/midtrans/route";
import { BillingService } from "@/services/billing-service";
import crypto from "node:crypto";

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn(async () => true),
  },
}));

describe("Phase 6 Integration Tests — Midtrans Webhook Endpoint", () => {
  const workspaceId = "ws-webhook-test-1";
  const userId = "usr-webhook-test-1";
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "SB-Mid-server-DEFAULT-MOCK-KEY";

  it("returns 401 Unauthorized when webhook payload signature is invalid or forged", async () => {
    const fakePayload = {
      order_id: "ORD_FAKE_123",
      status_code: "200",
      gross_amount: "149000.00",
      signature_key: "forged_signature_hash",
      transaction_status: "settlement",
    };

    const req = new Request("http://localhost:3000/api/webhooks/midtrans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakePayload),
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid Midtrans Webhook Signature");
  });

  it("successfully verifies webhook and activates subscription upon valid settlement", async () => {
    const orderId = `ORD_CREATOROS_INT_${Date.now()}`;
    const statusCode = "200";
    const grossAmount = "149000.00";

    await BillingService.createSubscriptionCheckout({
      workspaceId,
      userId,
      planTier: "creator",
      customOrderId: orderId,
    });

    const signatureKey = crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");

    const validPayload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: "settlement",
      payment_type: "qris",
    };

    const req = new Request("http://localhost:3000/api/webhooks/midtrans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.action).toBe("activated");
  });

  it("rejects spoofed webhook payload attempting serverKeyOverride in request body", async () => {
    const orderId = `ORD_CREATOROS_ATTACK_${Date.now()}`;
    const statusCode = "200";
    const grossAmount = "899000.00";
    const attackerKey = "attacker-forged-secret-key";

    // Attacker generates signature using their own key
    const spoofedSignature = crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${attackerKey}`)
      .digest("hex");

    const attackPayload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: spoofedSignature,
      transaction_status: "settlement",
      serverKeyOverride: attackerKey,
    };

    const req = new Request("http://localhost:3000/api/webhooks/midtrans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attackPayload),
    });

    const res = await webhookPost(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Invalid Midtrans Webhook Signature");
  });
});
