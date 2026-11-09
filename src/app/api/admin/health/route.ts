import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/services/admin-service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    const [health, metrics] = await Promise.all([
      AdminService.getSystemHealth(user.id),
      AdminService.getSystemAiUsageMetrics(user.id),
    ]);
    return NextResponse.json({ success: true, health, metrics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("Hanya Superadmin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
