import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/services/admin-service";
import { BillingService } from "@/services/billing-service";
import type { PlanTier } from "@/lib/supabase/types";

export async function GET() {
  try {
    const plans = await BillingService.getAvailablePlans();
    return NextResponse.json({ success: true, plans });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, updates } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId wajib diisi" }, { status: 400 });
    }

    const updated = await AdminService.updatePlanConfig(
      user.id,
      planId as PlanTier,
      updates
    );

    return NextResponse.json({ success: true, plan: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("Hanya Superadmin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
