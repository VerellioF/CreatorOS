import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";
import { WorkflowAutomationService } from "@/services/workflow-automation-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId parameter" }, { status: 400 });
    }

    const supabase = await createClient();

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
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === "create_schedule") {
      const schedule = await WorkflowAutomationService.createSchedule(body);
      return NextResponse.json({ success: true, schedule });
    }

    const run = await WorkflowOrchestratorService.startWorkflow(body);
    return NextResponse.json({ success: true, run });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 400 });
  }
}
