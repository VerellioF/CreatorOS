"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedWorkspaceIdFromCookie } from "@/lib/security/workspace-cookie";
import { createClient } from "@/lib/supabase/server";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";
import { WorkflowAutomationService } from "@/services/workflow-automation-service";
import type { WorkflowType } from "@/lib/supabase/types";

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function startWorkflowAction(
  workflowType: WorkflowType,
  title: string,
  initialParameters: Record<string, unknown> = {},
  autoApproveMilestones = false
): Promise<ActionResult<{ runId: string }>> {
  try {
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const run = await WorkflowOrchestratorService.startWorkflow({
      workspaceId,
      userId: user?.id,
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
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    const result = await WorkflowOrchestratorService.executeCurrentStep(runId, workspaceId);
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
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await WorkflowOrchestratorService.approveStep(runId, stepIndex, user?.id || "", workspaceId);
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve workflow step" };
  }
}

export async function pauseWorkflowAction(runId: string): Promise<ActionResult<boolean>> {
  try {
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    await WorkflowOrchestratorService.pauseWorkflow(runId, workspaceId);
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to pause workflow" };
  }
}

export async function resumeWorkflowAction(runId: string): Promise<ActionResult<boolean>> {
  try {
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    await WorkflowOrchestratorService.resumeWorkflow(runId, workspaceId);
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
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    await WorkflowOrchestratorService.cancelWorkflow(runId, workspaceId, reason);
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
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await WorkflowAutomationService.createSchedule({
      workspaceId,
      userId: user?.id,
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
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    await WorkflowAutomationService.toggleScheduleActive(scheduleId, workspaceId, isActive);
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
    const workspaceId = await getVerifiedWorkspaceIdFromCookie();
    if (!workspaceId) return { success: false, error: "No active workspace selected" };

    await WorkflowAutomationService.deleteSchedule(scheduleId, workspaceId);
    revalidatePath("/agents");
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete workflow schedule" };
  }
}
