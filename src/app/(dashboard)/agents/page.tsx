import { redirect } from "next/navigation";
import { getVerifiedWorkspaceIdFromCookie } from "@/lib/security/workspace-cookie";
import { createClient } from "@/lib/supabase/server";
import { AgentWorkspaceView } from "@/features/agents/components/agent-workspace-view";
import type {
  WorkflowRunRow,
  WorkflowStepRow,
  WorkflowScheduleRow,
  WorkflowLogRow,
} from "@/lib/supabase/types";

export const metadata = {
  title: "Agent Workspace & Automation | CreatorOS AI",
  description: "AI Agent coordination, automated multi-step workflows, and human-in-the-loop review",
};

export default async function AgentsPage() {
  const workspaceId = await getVerifiedWorkspaceIdFromCookie();
  if (!workspaceId) {
    redirect("/sign-in");
  }

  const supabase = await createClient();

  // 1. Fetch recent runs
  const { data: rawRuns } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);

  // 2. Fetch steps for these runs
  const runsWithSteps: Array<WorkflowRunRow & { steps: WorkflowStepRow[] }> = [];
  if (rawRuns && rawRuns.length > 0) {
    for (const run of rawRuns) {
      const { data: steps } = await supabase
        .from("workflow_steps")
        .select("*")
        .eq("workflow_run_id", run.id)
        .order("step_index", { ascending: true });

      runsWithSteps.push({
        ...(run as WorkflowRunRow),
        steps: (steps || []) as WorkflowStepRow[],
      });
    }
  }

  // 3. Fetch active schedules
  const { data: schedules } = await supabase
    .from("workflow_schedules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  // 4. Fetch recent logs
  const { data: logs } = await supabase
    .from("workflow_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-6">
      <AgentWorkspaceView
        initialRuns={runsWithSteps}
        initialSchedules={(schedules || []) as WorkflowScheduleRow[]}
        initialLogs={(logs || []) as WorkflowLogRow[]}
      />
    </div>
  );
}
