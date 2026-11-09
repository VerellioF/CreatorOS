import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsService } from "@/services/analytics-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";
import { analyticsQuerySchema, manualPerformanceEntrySchema } from "@/lib/validation/analytics-schemas";

const analyticsService = new AnalyticsService();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    const dateRangeParam = (searchParams.get("dateRange") as any) || "30d";
    const platformParam = searchParams.get("platform") || undefined;

    const overview = await analyticsService.getWorkspaceAnalyticsOverview(workspaceId, userId, {
      dateRange: dateRangeParam,
      platform: platformParam,
    });

    return NextResponse.json(overview);
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/analytics", method: "GET" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const item = await analyticsService.recordManualPerformanceEntry(workspaceId, userId, body);

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/analytics", method: "POST" } });
    const message = err instanceof Error ? err.message : "Gagal menyimpan metrik kinerja konten";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
