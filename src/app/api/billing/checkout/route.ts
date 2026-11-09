import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BillingService } from "@/services/billing-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    if (!body.workspaceId || !body.planTier) {
      return NextResponse.json(
        { error: "workspaceId dan planTier wajib diisi" },
        { status: 400 }
      );
    }

    const checkout = await BillingService.createSubscriptionCheckout({
      workspaceId: body.workspaceId,
      userId: user.id,
      planTier: body.planTier,
      userEmail: user.email,
      userName: user.user_metadata?.full_name,
    });

    return NextResponse.json({
      success: true,
      ...checkout,
    });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/billing/checkout", method: "POST" } });
    const message = err instanceof Error ? err.message : "Gagal membuat checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId wajib diisi" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    const [plans, subscription, history] = await Promise.all([
      BillingService.getAvailablePlans(),
      BillingService.getWorkspaceSubscription(workspaceId, userId),
      BillingService.getPaymentHistory(workspaceId, userId),
    ]);

    return NextResponse.json({
      plans,
      subscription,
      history,
    });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/billing/checkout", method: "GET" } });
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
