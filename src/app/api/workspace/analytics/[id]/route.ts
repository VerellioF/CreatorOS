import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsService } from "@/services/analytics-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

const analyticsService = new AnalyticsService();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(user.id, workspaceId, "viewer");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak ke workspace ini" }, { status: 403 });
    }

    const item = await analyticsService.getSnapshotById(workspaceId, user.id, id);
    if (!item) {
      return NextResponse.json({ error: "Snapshot metrik tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/analytics/[id]", method: "GET" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(user.id, workspaceId, "editor");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak ke workspace ini" }, { status: 403 });
    }

    await analyticsService.deleteSnapshot(workspaceId, user.id, id);
    return NextResponse.json({ success: true, message: "Snapshot berhasil dihapus" });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/analytics/[id]", method: "DELETE" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
