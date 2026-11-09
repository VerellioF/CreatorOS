import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PublishingService } from "@/services/publishing-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(user.id, workspaceId, "viewer");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak ke workspace ini" }, { status: 403 });
    }

    const [{ data: job }, logs] = await Promise.all([
      supabase
        .from("publishing_jobs")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .single(),
      PublishingService.getJobLogs(id, workspaceId, user.id),
    ]);

    return NextResponse.json({
      job,
      logs,
    });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/publishing/[id]", method: "GET" } });
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const workspaceId = body.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(user.id, workspaceId, "editor");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak ke workspace ini" }, { status: 403 });
    }

    if (body.action === "prepare_manual_export") {
      const result = await PublishingService.prepareManualExport(
        id,
        workspaceId,
        user.id
      );
      return NextResponse.json({ success: true, ...result });
    }

    if (body.action === "confirm_manual_publish") {
      const result = await PublishingService.confirmManualPublish(
        id,
        workspaceId,
        user.id,
        body.externalPostUrl
      );
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/publishing/[id]", method: "POST" } });
    const message = err instanceof Error ? err.message : "Gagal memproses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
