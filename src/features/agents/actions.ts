"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedWorkspaceIdFromCookie } from "@/lib/security/workspace-cookie";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";
import { WorkflowAutomationService } from "@/services/workflow-automation-service";
import type { WorkflowType } from "@/lib/supabase/types";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function resolveWorkspaceContext(): Promise<
  { workspaceId: string; userId?: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let workspaceId = await getVerifiedWorkspaceIdFromCookie();
  if (!workspaceId && user?.id) {
    const workspaces = await WorkspaceService.getWorkspacesForUser(user.id);
    if (workspaces && workspaces.length > 0) {
      workspaceId = workspaces[0].id;
    }
  }

  if (!workspaceId) {
    return { error: "No active workspace selected or found" };
  }

  return { workspaceId, userId: user?.id };
}

export async function startWorkflowAction(
  workflowType: WorkflowType,
  title: string,
  initialParameters: Record<string, unknown> = {},
  autoApproveMilestones = false
): Promise<ActionResult<{ runId: string }>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    const run = await WorkflowOrchestratorService.startWorkflow({
      workspaceId: context.workspaceId,
      userId: context.userId,
      workflowType,
      title,
      initialParameters,
      autoApproveMilestones,
    });

    revalidatePath("/agents");
    return { success: true, data: { runId: run.id } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to start workflow" };
  }
}

export async function executeNextStepAction(
  runId: string
): Promise<ActionResult<{ nextStatus: string }>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    const result = await WorkflowOrchestratorService.executeCurrentStep(runId, context.workspaceId);
    revalidatePath("/agents");
    return { success: true, data: { nextStatus: result.nextStatus } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to execute workflow step" };
  }
}

export async function approveStepAction(
  runId: string,
  stepIndex: number
): Promise<ActionResult<boolean>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    await WorkflowOrchestratorService.approveStep(
      runId,
      stepIndex,
      context.userId || "",
      context.workspaceId
    );
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve workflow step" };
  }
}

export async function pauseWorkflowAction(runId: string): Promise<ActionResult<boolean>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    await WorkflowOrchestratorService.pauseWorkflow(runId, context.workspaceId);
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to pause workflow" };
  }
}

export async function resumeWorkflowAction(runId: string): Promise<ActionResult<boolean>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    await WorkflowOrchestratorService.resumeWorkflow(runId, context.workspaceId);
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to resume workflow" };
  }
}

export async function cancelWorkflowAction(
  runId: string,
  reason?: string
): Promise<ActionResult<boolean>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    await WorkflowOrchestratorService.cancelWorkflow(runId, context.workspaceId, reason);
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel workflow" };
  }
}

export async function createWorkflowScheduleAction(
  workflowType: WorkflowType,
  name: string,
  cronExpression: string,
  parameters: Record<string, unknown> = {},
  maxAutonomousTurns = 5
): Promise<ActionResult<boolean>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    await WorkflowAutomationService.createSchedule({
      workspaceId: context.workspaceId,
      userId: context.userId,
      workflowType,
      name,
      cronExpression,
      parameters,
      maxAutonomousTurns,
    });

    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create workflow schedule" };
  }
}

export async function toggleWorkflowScheduleAction(
  scheduleId: string,
  isActive: boolean
): Promise<ActionResult<boolean>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    await WorkflowAutomationService.toggleScheduleActive(
      scheduleId,
      context.workspaceId,
      isActive
    );
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to toggle workflow schedule" };
  }
}

export async function deleteWorkflowScheduleAction(
  scheduleId: string
): Promise<ActionResult<boolean>> {
  try {
    const context = await resolveWorkspaceContext();
    if ("error" in context) return { success: false, error: context.error };

    await WorkflowAutomationService.deleteSchedule(scheduleId, context.workspaceId);
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete workflow schedule" };
  }
}
