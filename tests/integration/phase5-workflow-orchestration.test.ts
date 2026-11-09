import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowOrchestratorService } from "@/services/workflow-orchestrator-service";
import { createClient } from "@/lib/supabase/server";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: vi.fn(),
  };
});

describe("Phase 5 Integration Tests — Workflow Orchestration Engine", () => {
  const mockWorkspaceId = "11111111-1111-4111-8111-111111111111";
  const mockUserId = "22222222-2222-4222-8222-222222222222";

  // In-memory mock database state
  let runsTable: any[] = [];
  let stepsTable: any[] = [];
  let logsTable: any[] = [];

  beforeEach(() => {
    runsTable = [];
    stepsTable = [];
    logsTable = [];

    const mockSupabase = {
      from: (tableName: string) => {
        return {
          insert: (data: any) => {
            const items = Array.isArray(data) ? data : [data];
            const inserted = items.map((item) => ({
              id: item.id || `id_${Math.random().toString(36).substring(2, 9)}`,
              created_at: new Date().toISOString(),
              ...item,
            }));
            if (tableName === "workflow_runs") runsTable.push(...inserted);
            if (tableName === "workflow_steps") stepsTable.push(...inserted);
            if (tableName === "workflow_logs") logsTable.push(...inserted);
            return {
              select: () => ({
                single: async () => ({ data: inserted[0], error: null }),
                data: inserted,
                error: null,
              }),
              data: inserted,
              error: null,
            };
          },
          select: (columns = "*") => {
            return {
              eq: (col: string, val: any) => {
                let target = tableName === "workflow_runs" ? runsTable : stepsTable;
                let filtered = target.filter((r) => r[col] === val);
                return {
                  eq: (col2: string, val2: any) => {
                    filtered = filtered.filter((r) => r[col2] === val2);
                    return {
                      single: async () => ({ data: filtered[0] || null, error: null }),
                      order: () => ({ data: filtered, error: null }),
                      data: filtered,
                      error: null,
                    };
                  },
                  single: async () => ({ data: filtered[0] || null, error: null }),
                  order: () => ({ data: filtered, error: null }),
                  data: filtered,
                  error: null,
                };
              },
              order: () => ({
                data: tableName === "workflow_runs" ? runsTable : stepsTable,
                error: null,
              }),
            };
          },
          update: (updates: any) => {
            return {
              eq: (col: string, val: any) => {
                let target = tableName === "workflow_runs" ? runsTable : stepsTable;
                target.forEach((row) => {
                  if (row[col] === val) Object.assign(row, updates);
                });
                return {
                  eq: (col2: string, val2: any) => {
                    target.forEach((row) => {
                      if (row[col] === val && row[col2] === val2) Object.assign(row, updates);
                    });
                    return {
                      select: () => ({
                        single: async () => ({ data: target.find((r) => r[col] === val), error: null }),
                      }),
                      data: target,
                      error: null,
                    };
                  },
                  select: () => ({
                    single: async () => ({ data: target.find((r) => r[col] === val), error: null }),
                  }),
                  data: target,
                  error: null,
                };
              },
            };
          },
        };
      },
      rpc: async (fn: string, args: any) => {
        if (fn === "advance_workflow_step") {
          const run = runsTable.find((r) => r.id === args.p_run_id);
          const step = stepsTable.find(
            (s) => s.workflow_run_id === args.p_run_id && s.step_index === args.p_step_index
          );
          if (step) {
            step.status = "completed";
            step.output_payload = args.p_output;
          }
          if (run) {
            if (args.p_step_index + 1 < run.total_steps) {
              const nextStep = stepsTable.find(
                (s) => s.workflow_run_id === args.p_run_id && s.step_index === args.p_step_index + 1
              );
              if (nextStep && nextStep.requires_approval) {
                run.status = "waiting_approval";
                nextStep.status = "waiting_approval";
              } else {
                run.status = "running";
                if (nextStep) nextStep.status = "running";
              }
              run.current_step_index = args.p_step_index + 1;
            } else {
              run.status = "completed";
            }
          }
          return { data: { success: true, nextStatus: run?.status }, error: null };
        }

        if (fn === "approve_workflow_step") {
          const run = runsTable.find((r) => r.id === args.p_run_id);
          const step = stepsTable.find(
            (s) => s.workflow_run_id === args.p_run_id && s.step_index === args.p_step_index
          );
          if (step) {
            step.status = "running";
            step.approved_by = args.p_user_id;
            step.approved_at = new Date().toISOString();
          }
          if (run) {
            run.status = "running";
          }
          return { data: { success: true }, error: null };
        }

        if (fn === "cancel_workflow_run") {
          const run = runsTable.find((r) => r.id === args.p_run_id);
          if (run) run.status = "cancelled";
          stepsTable
            .filter((s) => s.workflow_run_id === args.p_run_id && s.status !== "completed")
            .forEach((s) => (s.status = "cancelled"));
          return { data: { success: true }, error: null };
        }

        return { data: null, error: null };
      },
    };

    (createClient as any).mockResolvedValue(mockSupabase);
  });

  it("satisfies Workflow A (Research -> Strategy -> Idea -> Script -> Storyboard) with human approval checkpoint", async () => {
    // 1. Start Workflow A
    const run = await WorkflowOrchestratorService.startWorkflow({
      workspaceId: mockWorkspaceId,
      userId: mockUserId,
      workflowType: "workflow_a_research_to_storyboard",
      title: "Content Production: AI Productivity Tools",
      initialParameters: { niche: "Tech Productivity", topic: "Top 5 AI tools in 2026" },
      autoApproveMilestones: false,
    });

    expect(run.workflow_type).toBe("workflow_a_research_to_storyboard");
    expect(run.total_steps).toBe(5);

    // 2. Execute Step 0 (Researcher)
    const step0Res = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step0Res.completedStep.agent_name).toBe("researcher");
    expect(step0Res.nextStatus).toBe("running");

    // 3. Execute Step 1 (Strategist)
    const step1Res = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step1Res.completedStep.agent_name).toBe("strategist");
    expect(step1Res.nextStatus).toBe("running");

    // 4. Execute Step 2 (Idea Generator)
    const step2Res = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step2Res.completedStep.agent_name).toBe("idea_generator");
    expect(step2Res.nextStatus).toBe("running");

    // 5. Execute Step 3 (Scriptwriter)
    const step3Res = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step3Res.completedStep.agent_name).toBe("scriptwriter");

    // Next step (Storyboard) requires human approval!
    expect(step3Res.nextStatus).toBe("waiting_approval");

    // 6. Inspect intermediate agent outputs while paused
    const pausedRun = await WorkflowOrchestratorService.getWorkflowDetails(run.id, mockWorkspaceId);
    expect(pausedRun.status).toBe("waiting_approval");
    expect(pausedRun.steps[3].output_payload).toBeDefined();

    // 7. Human approves Step 4 (Storyboard)
    await WorkflowOrchestratorService.approveStep(run.id, 4, mockUserId, mockWorkspaceId);

    // 8. Execute Step 4 (Storyboard)
    const step4Res = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step4Res.completedStep.agent_name).toBe("storyboard");
    expect(step4Res.nextStatus).toBe("completed");

    // 9. Inspect final completed run
    const completedRun = await WorkflowOrchestratorService.getWorkflowDetails(run.id, mockWorkspaceId);
    expect(completedRun.status).toBe("completed");
    expect(completedRun.steps.every((s) => s.status === "completed")).toBe(true);
  });

  it("satisfies Workflow B (Product Research -> Positioning -> Script -> Brief) and cancellation", async () => {
    const run = await WorkflowOrchestratorService.startWorkflow({
      workspaceId: mockWorkspaceId,
      userId: mockUserId,
      workflowType: "workflow_b_affiliate_pipeline",
      title: "Affiliate Campaign: Ergo Chair",
      initialParameters: { niche: "Workspace Gear", topic: "Ergonomic Chairs" },
      autoApproveMilestones: false,
    });

    expect(run.total_steps).toBe(4);

    // Cancel workflow
    const cancelRes = await WorkflowOrchestratorService.cancelWorkflow(run.id, mockWorkspaceId, "User cancelled");
    expect(cancelRes.status).toBe("cancelled");

    const cancelledRun = await WorkflowOrchestratorService.getWorkflowDetails(run.id, mockWorkspaceId);
    expect(cancelledRun.status).toBe("cancelled");
  });

  it("satisfies Workflow C (Performance Data -> Analysis -> Recommendations -> Strategy)", async () => {
    const run = await WorkflowOrchestratorService.startWorkflow({
      workspaceId: mockWorkspaceId,
      userId: mockUserId,
      workflowType: "workflow_c_analytics_optimization",
      title: "Analytics Loop",
      initialParameters: {
        contentItemId: "item_42",
        metrics: { views: 20000, likes: 1800, comments: 140, shares: 320, watchTimeSeconds: 45 },
      },
      autoApproveMilestones: false,
    });

    expect(run.total_steps).toBe(3);

    // Execute Analyst
    const step0 = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step0.completedStep.agent_name).toBe("analyst");

    // Execute Strategist
    const step1 = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step1.completedStep.agent_name).toBe("strategist");

    // Execute Monetization Coach
    const step2 = await WorkflowOrchestratorService.executeCurrentStep(run.id, mockWorkspaceId);
    expect(step2.completedStep.agent_name).toBe("monetization_coach");
    expect(step2.nextStatus).toBe("completed");
  });

  it("recovers interrupted dangling jobs on system restart", async () => {
    // Seed dangling job
    const runId = "run_interrupted_99";
    runsTable.push({
      id: runId,
      workspace_id: mockWorkspaceId,
      status: "running",
      current_step_index: 0,
      total_steps: 2,
    });
    stepsTable.push({
      id: "step_int_1",
      workflow_run_id: runId,
      workspace_id: mockWorkspaceId,
      step_index: 0,
      agent_name: "researcher",
      status: "running",
      started_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 mins ago
      retry_count: 0,
      max_retries: 2,
    });

    const recovered = await WorkflowOrchestratorService.recoverInterruptedJobs(mockWorkspaceId);
    expect(recovered.recoveredCount).toBeGreaterThanOrEqual(1);

    const step = stepsTable.find((s) => s.id === "step_int_1");
    expect(step.status).toBe("pending"); // Reset to retryable pending
  });
});
