import { BaseAgent, type AgentExecutionContext } from "./base-agent";
import {
  orchestratorInputSchema,
  orchestratorOutputSchema,
  type OrchestratorInput,
  type OrchestratorOutput,
} from "@/lib/validation/agent-schemas";

export class OrchestratorAgent extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  constructor() {
    super({
      name: "orchestrator",
      description: "Coordinates multi-agent execution DAGs, state transitions, and approval gates",
      inputSchema: orchestratorInputSchema,
      outputSchema: orchestratorOutputSchema,
      maxRetries: 1,
      timeoutMs: 30000,
      defaultCredits: 0,
    });
  }

  protected async runInternal(
    input: OrchestratorInput,
    _context: AgentExecutionContext,
    log: (level: "info" | "warn" | "error" | "debug", message: string) => void
  ): Promise<{ output: OrchestratorOutput }> {
    log("info", `Planning workflow DAG for trigger: ${input.trigger}`);

    const planId = `plan_${Date.now()}`;

    if (input.trigger === "create_content") {
      return {
        output: {
          planId,
          workflowType: "workflow_a_research_to_storyboard",
          title: `Content Production Pipeline: ${(input.parameters?.topic as string) || "New Campaign"}`,
          steps: [
            { stepIndex: 0, agentName: "researcher", requiresApproval: false, description: "Market and trend research" },
            { stepIndex: 1, agentName: "strategist", requiresApproval: false, description: "Strategic positioning and pillars" },
            { stepIndex: 2, agentName: "idea_generator", requiresApproval: false, description: "Creative hooks and idea generation" },
            { stepIndex: 3, agentName: "scriptwriter", requiresApproval: true, description: "Full scriptwriting with human review gate" },
            { stepIndex: 4, agentName: "storyboard", requiresApproval: false, description: "Scene-by-scene shoot storyboard" },
          ],
          estimatedCredits: 5,
        },
      };
    }

    if (input.trigger === "weekly_strategy") {
      return {
        output: {
          planId,
          workflowType: "workflow_c_analytics_optimization",
          title: "Weekly Content Diagnostics & Strategy Refresh",
          steps: [
            { stepIndex: 0, agentName: "analyst", requiresApproval: false, description: "Historical performance diagnostics" },
            { stepIndex: 1, agentName: "strategist", requiresApproval: false, description: "Adjusted content pillars" },
            { stepIndex: 2, agentName: "monetization_coach", requiresApproval: false, description: "Commercial funnel opportunities" },
          ],
          estimatedCredits: 3,
        },
      };
    }

    // Default / affiliate / custom pipeline
    return {
      output: {
        planId,
        workflowType: "workflow_b_affiliate_pipeline",
        title: "Affiliate Product Monetization Pipeline",
        steps: [
          { stepIndex: 0, agentName: "researcher", requiresApproval: false, description: "Product & audience research" },
          { stepIndex: 1, agentName: "monetization_coach", requiresApproval: false, description: "Affiliate commission & positioning" },
          { stepIndex: 2, agentName: "scriptwriter", requiresApproval: true, description: "High-converting affiliate script" },
          { stepIndex: 3, agentName: "designer", requiresApproval: false, description: "Promotional thumbnail and carousel briefs" },
        ],
        estimatedCredits: 4,
      },
    };
  }
}
