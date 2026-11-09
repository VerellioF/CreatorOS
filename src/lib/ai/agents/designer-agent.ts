import { BaseAgent, type AgentExecutionContext } from "./base-agent";
import {
  designerAgentInputSchema,
  designerAgentOutputSchema,
  type DesignerAgentInput,
  type DesignerAgentOutput,
} from "@/lib/validation/agent-schemas";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import { DESIGNER_AGENT_JSON_SCHEMA } from "@/lib/ai/schemas/agent-json-schemas";

export class DesignerAgent extends BaseAgent<DesignerAgentInput, DesignerAgentOutput> {
  constructor() {
    super({
      name: "designer",
      description: "Generates visual design prompts, color palette guides, and layout specifications",
      inputSchema: designerAgentInputSchema,
      outputSchema: designerAgentOutputSchema,
      maxRetries: 2,
      timeoutMs: 40000,
      defaultCredits: 1,
    });
  }

  protected async runInternal(
    input: DesignerAgentInput,
    context: AgentExecutionContext,
    log: (level: "info" | "warn" | "error" | "debug", message: string) => void
  ): Promise<{ output: DesignerAgentOutput; tokensUsed?: number; costUsd?: number }> {
    log("info", `Designing visuals for assetType: ${input.assetType}, title: ${input.title}`);

    if (process.env.GEMINI_API_KEY && context.userId) {
      try {
        const prompt = `You are the Senior Visual Designer Agent for CreatorOS AI.
Title: ${input.title}
Visual Theme: ${input.visualTheme}
Palette: Primary ${input.palette.primary}, Secondary ${input.palette.secondary}
Asset Type: ${input.assetType}

Produce a high-CTR graphic brief including suggested headline, detailed generative image prompt, negative prompt, layout guidelines, and recommended pixel dimensions.`;

        const gen = await executeValidatedStructuredGeneration<DesignerAgentOutput>({
          workspaceId: context.workspaceId,
          userId: context.userId,
          agentName: "DesignerAgent",
          operationType: "image_generation",
          systemPrompt: "You are an elite YouTube/TikTok graphic designer and thumbnail strategist. Produce strict JSON only.",
          userPrompt: prompt,
          schemaName: "designer_agent_schema",
          jsonSchema: DESIGNER_AGENT_JSON_SCHEMA as any,
          zodSchema: designerAgentOutputSchema,
        });

        return {
          output: gen.data,
          tokensUsed: gen.usage.totalTokens,
          costUsd: gen.usage.estimatedCostUsd,
        };
      } catch (err) {
        log("warn", `AI provider call failed, falling back to deterministic visual design brief: ${err}`);
      }
    }

    const dims = input.assetType === "thumbnail" ? { width: 1280, height: 720 } : { width: 1080, height: 1920 };

    return {
      output: {
        suggestedHeadline: input.title.toUpperCase(),
        imagePrompt: `High contrast modern graphic showcasing "${input.title}". ${input.visualTheme} aesthetic with glowing accents in ${input.palette.primary} set against deep dark tones in ${input.palette.secondary}. Clean 3D studio lighting, photorealistic sharp focal depth.`,
        negativePrompt: "lowres, blurry, distorted text, ugly faces, bad anatomy, noisy background artifacts",
        layoutGuidelines: "Bold typography occupying upper third, key focal subject on center-right, high contrast rim lighting.",
        recommendedDimensions: dims,
      },
      tokensUsed: 350,
      costUsd: 0.0001,
    };
  }
}
