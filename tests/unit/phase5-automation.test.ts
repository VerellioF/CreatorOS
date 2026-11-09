import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowAutomationService } from "@/services/workflow-automation-service";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: vi.fn(),
  };
});

describe("Phase 5 Automation & Scheduling Service", () => {
  const mockWorkspaceId = "11111111-1111-4111-8111-111111111111";
  const mockUserId = "22222222-2222-4222-8222-222222222222";

  let schedulesTable: any[] = [];

  beforeEach(() => {
    schedulesTable = [];

    const mockSupabase = {
      from: (tableName: string) => {
        return {
          insert: (data: any) => {
            const inserted = {
              id: `sched_${Date.now()}`,
              created_at: new Date().toISOString(),
              ...data,
            };
            schedulesTable.push(inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted, error: null }),
              }),
            };
          },
          select: () => {
            return {
              eq: (col: string, val: any) => {
                let filtered = schedulesTable.filter((s) => s[col] === val);
                return {
                  eq: (col2: string, val2: any) => {
                    filtered = filtered.filter((s) => s[col2] === val2);
                    return {
                      single: async () => ({ data: filtered[0] || null, error: null }),
                      data: filtered,
                      error: null,
                    };
                  },
                  single: async () => ({ data: filtered[0] || null, error: null }),
                  data: filtered,
                  error: null,
                };
              },
            };
          },
          update: (updates: any) => {
            return {
              eq: (col: string, val: any) => {
                schedulesTable.forEach((s) => {
                  if (s[col] === val) Object.assign(s, updates);
                });
                return {
                  eq: (col2: string, val2: any) => {
                    schedulesTable.forEach((s) => {
                      if (s[col] === val && s[col2] === val2) Object.assign(s, updates);
                    });
                    return {
                      select: () => ({
                        single: async () => ({
                          data: schedulesTable.find((s) => s[col] === val),
                          error: null,
                        }),
                      }),
                      error: null,
                    };
                  },
                  select: () => ({
                    single: async () => ({
                      data: schedulesTable.find((s) => s[col] === val),
                      error: null,
                    }),
                  }),
                  error: null,
                };
              },
            };
          },
          delete: () => {
            return {
              eq: (col: string, val: any) => {
                schedulesTable = schedulesTable.filter((s) => s[col] !== val);
                return { error: null };
              },
            };
          },
        };
      },
    };

    (createClient as any).mockResolvedValue(mockSupabase);
  });

  it("creates a recurring workflow schedule with nextRunAt calculation and turns cap", async () => {
    const schedule = await WorkflowAutomationService.createSchedule({
      workspaceId: mockWorkspaceId,
      userId: mockUserId,
      workflowType: "workflow_a_research_to_storyboard",
      name: "Monday Morning Content Sprint",
      cronExpression: "0 9 * * 1",
      parameters: { niche: "Tech", topic: "Weekly Tech Trends" },
      maxAutonomousTurns: 5,
    });

    expect(schedule.name).toBe("Monday Morning Content Sprint");
    expect(schedule.is_active).toBe(true);
    expect(schedule.next_run_at).toBeDefined();
    expect(schedule.max_autonomous_turns).toBeLessThanOrEqual(5);
  });

  it("rejects schedules that attempt unbounded autonomous turns (> 5)", async () => {
    await expect(
      WorkflowAutomationService.createSchedule({
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        workflowType: "workflow_a_research_to_storyboard",
        name: "Unbounded Loop",
        cronExpression: "0 9 * * 1",
        parameters: {},
        maxAutonomousTurns: 20,
      })
    ).rejects.toThrow();
  });

  it("toggles active state of a schedule (pause/resume)", async () => {
    const created = await WorkflowAutomationService.createSchedule({
      workspaceId: mockWorkspaceId,
      userId: mockUserId,
      workflowType: "workflow_b_affiliate_pipeline",
      name: "Affiliate Auto-Runner",
      cronExpression: "0 12 * * 3",
      parameters: {},
      maxAutonomousTurns: 5,
    });

    const paused = await WorkflowAutomationService.toggleScheduleActive(
      created.id,
      mockWorkspaceId,
      false
    );
    expect(paused.is_active).toBe(false);

    const resumed = await WorkflowAutomationService.toggleScheduleActive(
      created.id,
      mockWorkspaceId,
      true
    );
    expect(resumed.is_active).toBe(true);
  });

  it("triggers due schedules into workflow runs safely", async () => {
    const startWorkflowSpy = vi.spyOn(WorkflowOrchestratorService, "startWorkflow").mockResolvedValue({
      id: "run_auto_1",
      workspace_id: mockWorkspaceId,
      workflow_type: "workflow_a_research_to_storyboard",
      title: "Scheduled Run",
      status: "running",
      current_step_index: 0,
      total_steps: 5,
      total_tokens_used: 0,
      total_cost_usd: 0,
      total_credits_deducted: 0,
      initial_parameters: {},
      workflow_context: {},
      error_message: null,
      created_by: mockUserId,
      started_at: new Date().toISOString(),
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed due schedule
    schedulesTable.push({
      id: "sched_due_1",
      workspace_id: mockWorkspaceId,
      workflow_type: "workflow_a_research_to_storyboard",
      name: "Due Schedule",
      cronExpression: "0 9 * * 1",
      parameters: { niche: "Tech" },
      is_active: true,
      max_autonomous_turns: 5,
      next_run_at: new Date(Date.now() - 1000).toISOString(), // in the past
      last_run_at: null,
    });

    const result = await WorkflowAutomationService.processDueSchedules(mockWorkspaceId);
    expect(result.triggeredRuns).toHaveLength(1);
    expect(startWorkflowSpy).toHaveBeenCalled();
  });
});
