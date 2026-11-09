import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";

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

    const workflow = await WorkflowOrchestratorService.getWorkflowDetails(id, workspaceId);

    // Fetch related logs
    const supabase = await createClient();
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
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
