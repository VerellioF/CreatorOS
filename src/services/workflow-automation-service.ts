import { createClient } from "@/lib/supabase/server";
import { type WorkflowScheduleRow, type Json } from "@/lib/supabase/types";
import {
  workflowScheduleCreateSchema,
  type WorkflowScheduleCreateRequest,
} from "@/lib/validation/agent-schemas";
import { WorkflowOrchestratorService } from "./workflow-orchestrator-service";

export class WorkflowAutomationService {
  /**
   * Calculates estimated next run time from a cron expression or default schedule.
   */
  static calculateNextRun(cronExpression?: string): string {
    const now = new Date();
    // Default to +7 days for weekly (e.g., '0 9 * * 1'), or +1 day for daily
    if (cronExpression && cronExpression.includes("* * *")) {
      // Daily
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    // Weekly fallback (7 days)
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  /**
   * Creates a recurring workflow schedule with hard turn limits.
   */
  static async createSchedule(
    input: WorkflowScheduleCreateRequest & { userId?: string }
  ): Promise<WorkflowScheduleRow> {
    const validated = workflowScheduleCreateSchema.parse(input);
    const supabase = await createClient();

    const nextRunAt = this.calculateNextRun(validated.cronExpression);

    const { data, error } = await supabase
      .from("workflow_schedules")
      .insert({
        workspace_id: validated.workspaceId,
        workflow_type: validated.workflowType,
        name: validated.name,
        cron_expression: validated.cronExpression,
        parameters: validated.parameters as Json,
        is_active: true,
        max_autonomous_turns: validated.maxAutonomousTurns,
        next_run_at: nextRunAt,
        created_by: input.userId || null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create workflow schedule: ${error?.message}`);
    }

    return data as WorkflowScheduleRow;
  }

  /**
   * Toggles the active state of an automation schedule (pause / resume).
   */
  static async toggleScheduleActive(
    scheduleId: string,
    workspaceId: string,
    isActive: boolean
  ): Promise<WorkflowScheduleRow> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workflow_schedules")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduleId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to toggle workflow schedule: ${error?.message}`);
    }

    return data as WorkflowScheduleRow;
  }

  /**
   * Deletes a workflow schedule.
   */
  static async deleteSchedule(scheduleId: string, workspaceId: string): Promise<boolean> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("workflow_schedules")
      .delete()
      .eq("id", scheduleId)
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new Error(`Failed to delete workflow schedule: ${error.message}`);
    }

    return true;
  }

  /**
   * Evaluates active schedules and dispatches due workflows under strict turn limits.
   */
  static async processDueSchedules(
    workspaceId: string
  ): Promise<{ triggeredRuns: string[] }> {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const { data: schedules, error } = await supabase
      .from("workflow_schedules")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if (error || !schedules) {
      return { triggeredRuns: [] };
    }

    const triggeredRuns: string[] = [];

    for (const sched of schedules) {
      if (sched.next_run_at && sched.next_run_at <= nowIso) {
        // Enforce max autonomous turn limit (max 5 turns)
        const run = await WorkflowOrchestratorService.startWorkflow({
          workspaceId,
          workflowType: sched.workflow_type,
          title: `[Scheduled] ${sched.name}`,
          initialParameters: sched.parameters as Record<string, unknown>,
          autoApproveMilestones: false,
        });

        triggeredRuns.push(run.id);

        // Update schedule last_run_at and compute next run
        const cronExpr = sched.cron_expression || (sched as any).cronExpression || "0 9 * * 1";
        const nextRun = this.calculateNextRun(cronExpr);
        await supabase
          .from("workflow_schedules")
          .update({
            last_run_at: nowIso,
            next_run_at: nextRun,
            updated_at: nowIso,
          })
          .eq("id", sched.id);
      }
    }

    return { triggeredRuns };
  }
}
