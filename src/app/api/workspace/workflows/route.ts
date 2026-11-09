import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";
import { WorkflowAutomationService } from "@/services/workflow-automation-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

export async function GET(req: Request) {
  try {
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

    // 1. Fetch recent runs
    const { data: runs, error: runsErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

    // 2. Fetch active schedules
    const { data: schedules, error: schedErr } = await supabase
      .from("workflow_schedules")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (schedErr) {
      return NextResponse.json({ error: schedErr.message }, { status: 500 });
    }

    return NextResponse.json({
      runs: runs || [],
      schedules: schedules || [],
    });
  } catch (err: any) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/workflows", method: "GET" } });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    const body = await req.json();
    const workspaceId = body.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(user.id, workspaceId, "editor");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak ke workspace ini" }, { status: 403 });
    }

    // Bind authenticated user ID
    const payload = {
      ...body,
      userId: user.id,
    };

    if (body.action === "create_schedule") {
      const schedule = await WorkflowAutomationService.createSchedule(payload);
      return NextResponse.json({ success: true, schedule });
    }

    const run = await WorkflowOrchestratorService.startWorkflow(payload);
    return NextResponse.json({ success: true, run });
  } catch (err: any) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/workflows", method: "POST" } });
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 400 });
  }
}
