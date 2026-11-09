import { NextResponse } from "next/server";
import { BillingService } from "@/services/billing-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

export async function POST(req: Request) {
  try {
    const rawPayload = await req.json();

    if (!rawPayload.order_id || !rawPayload.status_code || !rawPayload.gross_amount || !rawPayload.signature_key) {
      return NextResponse.json(
        { error: "Payload webhook Midtrans tidak lengkap" },
        { status: 400 }
      );
    }

    // STRICT SECURITY: Strip client-supplied serverKeyOverride so external callers cannot bypass SHA-512 verification
    const { serverKeyOverride: _untrusted, ...sanitizedPayload } = rawPayload;

    const result = await BillingService.handleMidtransWebhook(sanitizedPayload);

    return NextResponse.json({
      status: "ok",
      action: result.action,
    });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/webhooks/midtrans" } });
    const message = err instanceof Error ? err.message : "Gagal memproses webhook";
    // Return 401 on signature verification failure
    const status = message.includes("Invalid Midtrans Webhook Signature") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
