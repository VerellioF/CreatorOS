import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";
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
      return NextResponse.json({ error: "Missing workspaceId parameter" }, { status: 400 });
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

    const workflow = await WorkflowOrchestratorService.getWorkflowDetails(id, workspaceId);

    // Fetch related logs
    const { data: logs } = await supabase
      .from("workflow_logs")
      .select("*")
      .eq("workflow_run_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      workflow,
      logs: logs || [],
    });
  } catch (err: any) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/workflows/[id]", method: "GET" } });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
