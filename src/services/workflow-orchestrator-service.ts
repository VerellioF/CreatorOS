import { createClient } from "@/lib/supabase/server";
import {
  type WorkflowRunRow,
  type WorkflowStepRow,
  type WorkflowStepStatus,
  type WorkflowType,
  type Json,
} from "@/lib/supabase/types";
import {
  startWorkflowRequestSchema,
  type StartWorkflowRequest,
} from "@/lib/validation/agent-schemas";
import {
  ResearcherAgent,
  StrategistAgent,
  IdeaGeneratorAgent,
  ScriptwriterAgent,
  StoryboardAgent,
  DesignerAgent,
  ProducerAgent,
  AnalystAgent,
  MonetizationCoachAgent,
  OrchestratorAgent,
  type BaseAgent,
} from "@/lib/ai/agents";

export interface WorkflowStepDefinition {
  agentName: string;
  description: string;
  requiresApproval: boolean;
}

export const WORKFLOW_DEFINITIONS: Record<WorkflowType, WorkflowStepDefinition[]> = {
  workflow_a_research_to_storyboard: [
    { agentName: "researcher", description: "Market & Trend Research", requiresApproval: false },
    { agentName: "strategist", description: "Content Strategy & Pillars", requiresApproval: false },
    { agentName: "idea_generator", description: "Creative Ideation & Angles", requiresApproval: false },
    { agentName: "scriptwriter", description: "Retention Scriptwriting", requiresApproval: false },
    { agentName: "storyboard", description: "Visual Scene Shoot Storyboard", requiresApproval: true },
  ],
  workflow_b_affiliate_pipeline: [
    { agentName: "researcher", description: "Product & Market Research", requiresApproval: false },
    { agentName: "monetization_coach", description: "Affiliate Commission & Funnel Positioning", requiresApproval: false },
    { agentName: "scriptwriter", description: "High-Converting Affiliate Script", requiresApproval: true },
    { agentName: "designer", description: "Promotional Visual & Thumbnail Design", requiresApproval: false },
  ],
  workflow_c_analytics_optimization: [
    { agentName: "analyst", description: "Content Performance & Drop-Off Diagnostics", requiresApproval: false },
    { agentName: "strategist", description: "Iterative Strategic Recommendations", requiresApproval: false },
    { agentName: "monetization_coach", description: "Commercial Monetization Opportunities", requiresApproval: false },
  ],
  custom: [
    { agentName: "orchestrator", description: "Dynamic Workflow Planner", requiresApproval: false },
  ],
};

export class WorkflowOrchestratorService {
  private static agentRegistry: Record<string, BaseAgent<any, any>> = {
    orchestrator: new OrchestratorAgent(),
    researcher: new ResearcherAgent(),
    strategist: new StrategistAgent(),
    idea_generator: new IdeaGeneratorAgent(),
    scriptwriter: new ScriptwriterAgent(),
    storyboard: new StoryboardAgent(),
    designer: new DesignerAgent(),
    producer: new ProducerAgent(),
    analyst: new AnalystAgent(),
    monetization_coach: new MonetizationCoachAgent(),
  };

  /**
   * Initializes a workflow run and provisions its execution steps.
   */
  static async startWorkflow(
    input: StartWorkflowRequest & { userId?: string }
  ): Promise<WorkflowRunRow> {
    const validated = startWorkflowRequestSchema.parse(input);
    const supabase = await createClient();

    const stepDefs = WORKFLOW_DEFINITIONS[validated.workflowType] || WORKFLOW_DEFINITIONS.custom;

    // 1. Create workflow_runs row
    const { data: run, error: runError } = await supabase
      .from("workflow_runs")
      .insert({
        workspace_id: validated.workspaceId,
        workflow_type: validated.workflowType,
        title: validated.title,
        status: "running",
        current_step_index: 0,
        total_steps: stepDefs.length,
        initial_parameters: validated.initialParameters as Json,
        created_by: input.userId || null,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(`Failed to create workflow run: ${runError?.message}`);
    }

    // 2. Create workflow_steps rows
    const stepInserts = stepDefs.map((def, idx) => ({
      workflow_run_id: run.id,
      workspace_id: validated.workspaceId,
      step_index: idx,
      agent_name: def.agentName,
      status: (idx === 0 ? "running" : "pending") as WorkflowStepStatus,
      requires_approval: validated.autoApproveMilestones ? false : def.requiresApproval,
      started_at: idx === 0 ? new Date().toISOString() : null,
    }));

    const { error: stepsError } = await supabase.from("workflow_steps").insert(stepInserts);
    if (stepsError) {
      throw new Error(`Failed to initialize workflow steps: ${stepsError.message}`);
    }

    return run as WorkflowRunRow;
  }

  /**
   * Executes the current pending/running step of an active workflow.
   */
  static async executeCurrentStep(
    runId: string,
    workspaceId: string
  ): Promise<{ completedStep: WorkflowStepRow; nextStatus: string }> {
    const supabase = await createClient();

    // 1. Get workflow run details
    const { data: run, error: runErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .single();

    if (runErr || !run) {
      throw new Error(`Workflow run not found: ${runErr?.message}`);
    }

    if (run.status === "waiting_approval") {
      throw new Error("Cannot execute step: Workflow is waiting for human approval.");
    }

    if (run.status === "completed" || run.status === "cancelled") {
      throw new Error(`Cannot execute step: Workflow is already ${run.status}.`);
    }

    // 2. Get current step
    const { data: currentStep, error: stepErr } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workflow_run_id", runId)
      .eq("step_index", run.current_step_index)
      .single();

    if (stepErr || !currentStep) {
      throw new Error(`Step ${run.current_step_index} not found: ${stepErr?.message}`);
    }

    // 3. Gather upstream outputs
    const { data: priorSteps } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workflow_run_id", runId);

    const accumulatedContext: Record<string, unknown> = {
      ...(run.initial_parameters as Record<string, unknown>),
    };

    if (priorSteps) {
      for (const step of priorSteps) {
        if (step.status === "completed" && step.output_payload) {
          accumulatedContext[step.agent_name] = step.output_payload;
        }
      }
    }

    // 4. Resolve Agent and synthesize input
    const agent = this.agentRegistry[currentStep.agent_name];
    if (!agent) {
      throw new Error(`No registered agent found for: ${currentStep.agent_name}`);
    }

    const agentInput = this.buildAgentInput(currentStep.agent_name, accumulatedContext, workspaceId);

    // 5. Execute agent with policy
    const executionResult = await agent.execute(agentInput, {
      workspaceId,
      runId,
      stepIndex: currentStep.step_index,
    });

    // 6. Record logs
    if (executionResult.logs?.length > 0) {
      const logsToInsert = executionResult.logs.map((l) => ({
        workspace_id: workspaceId,
        workflow_run_id: runId,
        workflow_step_id: currentStep.id,
        agent_name: currentStep.agent_name,
        log_level: l.level,
        message: l.message,
        metadata: (l.metadata || {}) as Json,
      }));
      await supabase.from("workflow_logs").insert(logsToInsert);
    }

    // 7. Advance workflow step atomically
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("advance_workflow_step", {
      p_run_id: runId,
      p_step_index: currentStep.step_index,
      p_output: executionResult.output as Json,
      p_tokens: executionResult.tokensUsed,
      p_cost: executionResult.costUsd,
      p_credits: executionResult.creditsDeducted,
    });

    if (rpcErr) {
      throw new Error(`Failed to advance workflow step: ${rpcErr.message}`);
    }

    return {
      completedStep: {
        ...currentStep,
        status: "completed",
        output_payload: executionResult.output as Json,
      } as WorkflowStepRow,
      nextStatus: (rpcRes as any)?.nextStatus || "running",
    };
  }

  /**
   * Approves a step waiting for human review and resumes execution.
   */
  static async approveStep(
    runId: string,
    stepIndex: number,
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("approve_workflow_step", {
      p_run_id: runId,
      p_step_index: stepIndex,
      p_user_id: userId,
    });

    if (error) {
      throw new Error(`Failed to approve workflow step: ${error.message}`);
    }

    return true;
  }

  /**
   * Pauses an actively running workflow.
   */
  static async pauseWorkflow(runId: string, workspaceId: string): Promise<boolean> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("pause_workflow_run", { p_run_id: runId });
    if (error) throw new Error(`Failed to pause workflow: ${error.message}`);
    return true;
  }

  /**
   * Resumes a paused workflow.
   */
  static async resumeWorkflow(runId: string, workspaceId: string): Promise<boolean> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("resume_workflow_run", { p_run_id: runId });
    if (error) throw new Error(`Failed to resume workflow: ${error.message}`);
    return true;
  }

  /**
   * Cancels a workflow run and all non-completed steps.
   */
  static async cancelWorkflow(
    runId: string,
    workspaceId: string,
    reason = "Cancelled by user"
  ): Promise<{ status: "cancelled" }> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_workflow_run", {
      p_run_id: runId,
      p_reason: reason,
    });
    if (error) throw new Error(`Failed to cancel workflow: ${error.message}`);
    return { status: "cancelled" };
  }

  /**
   * Retrieves full workflow details with steps and logs.
   */
  static async getWorkflowDetails(
    runId: string,
    workspaceId: string
  ): Promise<WorkflowRunRow & { steps: WorkflowStepRow[] }> {
    const supabase = await createClient();

    const { data: run, error: runErr } = await supabase
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .single();

    if (runErr || !run) {
      throw new Error(`Workflow run not found: ${runErr?.message}`);
    }

    const { data: steps, error: stepsErr } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workflow_run_id", runId)
      .order("step_index", { ascending: true });

    if (stepsErr) {
      throw new Error(`Failed to load workflow steps: ${stepsErr.message}`);
    }

    return {
      ...(run as WorkflowRunRow),
      steps: (steps || []) as WorkflowStepRow[],
    };
  }

  /**
   * Detects interrupted running steps on server reboot and resets them safely.
   */
  static async recoverInterruptedJobs(
    workspaceId: string
  ): Promise<{ recoveredCount: number }> {
    const supabase = await createClient();

    // Query steps that are 'running' and older than 5 minutes
    const thresholdTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: danglingSteps, error } = await supabase
      .from("workflow_steps")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("status", "running");

    if (error || !danglingSteps) return { recoveredCount: 0 };

    let recoveredCount = 0;
    for (const step of danglingSteps) {
      if (step.started_at && step.started_at < thresholdTime) {
        await supabase
          .from("workflow_steps")
          .update({
            status: "pending",
          })
          .eq("id", step.id);
        recoveredCount++;
      }
    }

    return { recoveredCount };
  }

  /**
   * Context-aware input synthesis bridging upstream agent outputs to downstream agents.
   */
  private static buildAgentInput(
    agentName: string,
    context: Record<string, any>,
    workspaceId: string
  ): Record<string, any> {
    switch (agentName) {
      case "researcher":
        return {
          niche: context.niche || "Content Creation",
          topicQuery: context.topic || "Best AI creation workflows",
          platforms: ["tiktok", "instagram"],
          language: "id",
        };

      case "strategist":
        return {
          creatorDna: {
            niche: context.niche || "Content Creation",
            tone: ["practical", "approachable"],
            archetype: "The Guide",
          },
          timeframeWeeks: 4,
          weeklyCadence: 3,
        };

      case "idea_generator":
        return {
          pillarName: context.strategist?.pillars?.[0]?.name || context.niche || "Tutorial",
          count: 3,
          platform: "tiktok",
          creatorTone: ["sharp", "entertaining"],
        };

      case "scriptwriter":
        return {
          ideaTitle:
            context.idea_generator?.ideas?.[0]?.title ||
            context.topic ||
            "Tutorial Produktivitas Konten",
          hookAngle: context.idea_generator?.ideas?.[0]?.hookAngle || "curiosity",
          platform: "tiktok",
          targetDurationSeconds: 45,
          framework: "PAS",
          creatorPersona: { tone: ["casual", "sharp"], language: "id" },
        };

      case "storyboard":
        return {
          fullScriptText:
            context.scriptwriter?.bodyContent ||
            "Opening Hook... Body content breakdown... Closing CTA...",
          aspectRatio: "9:16",
        };

      case "designer":
        return {
          title: context.scriptwriter?.openingHook || context.topic || "Content Masterclass",
          visualTheme: "Cyber Minimalist",
          palette: { primary: "#00E5FF", secondary: "#1A1A2E" },
          assetType: "thumbnail",
        };

      case "producer":
        return {
          voiceId: "budi",
          language: "id",
          generateVideoPreviews: true,
        };

      case "analyst":
        return {
          contentItemId: context.contentItemId || "item_sample",
          metrics: context.metrics || {
            views: 10000,
            likes: 800,
            comments: 65,
            shares: 150,
            watchTimeSeconds: 30,
          },
        };

      case "monetization_coach":
        return {
          workspaceId,
          creatorMode: "affiliate",
          currentFollowers: 10000,
          avgViewsPerPost: 5000,
        };

      default:
        return {
          workspaceId,
          trigger: "custom_prompt",
          parameters: context,
        };
    }
  }
}
