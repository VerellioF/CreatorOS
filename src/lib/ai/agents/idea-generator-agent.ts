import { BaseAgent, type AgentExecutionContext } from "./base-agent";
import {
  ideaGeneratorInputSchema,
  ideaGeneratorOutputSchema,
  type IdeaGeneratorInput,
  type IdeaGeneratorOutput,
} from "@/lib/validation/agent-schemas";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import { IDEA_GENERATOR_AGENT_JSON_SCHEMA } from "@/lib/ai/schemas/agent-json-schemas";

export class IdeaGeneratorAgent extends BaseAgent<IdeaGeneratorInput, IdeaGeneratorOutput> {
  constructor() {
    super({
      name: "idea_generator",
      description: "Generates creative, psychologically triggered content hooks and concepts",
      inputSchema: ideaGeneratorInputSchema,
      outputSchema: ideaGeneratorOutputSchema,
      maxRetries: 2,
      timeoutMs: 40000,
      defaultCredits: 1,
    });
  }

  protected async runInternal(
    input: IdeaGeneratorInput,
    context: AgentExecutionContext,
    log: (level: "info" | "warn" | "error" | "debug", message: string) => void
  ): Promise<{ output: IdeaGeneratorOutput; tokensUsed?: number; costUsd?: number }> {
    log("info", `Generating ${input.count} ideas for pillar: ${input.pillarName}`);

    if (process.env.GEMINI_API_KEY && context.userId) {
      try {
        const prompt = `You are the Idea Generator Agent for CreatorOS AI.
Pillar: ${input.pillarName}
Platform: ${input.platform}
Tone: ${input.creatorTone.join(", ")}
Target Count: ${input.count}

Generate ${input.count} creative short-form content ideas with psychological hook angles (curiosity, contrarian, tutorial, case_study, relatable), catchy previews, target emotion, and estimated potential score (0-100).`;

        const gen = await executeValidatedStructuredGeneration<IdeaGeneratorOutput>({
          workspaceId: context.workspaceId,
          userId: context.userId,
          agentName: "IdeaGeneratorAgent",
          operationType: "content_idea_generation",
          systemPrompt: "You are a master creative director and viral hook generator. Produce strict JSON only.",
          userPrompt: prompt,
          schemaName: "idea_generator_agent_schema",
          jsonSchema: IDEA_GENERATOR_AGENT_JSON_SCHEMA as any,
          zodSchema: ideaGeneratorOutputSchema,
        });

        return {
          output: gen.data,
          tokensUsed: gen.usage.totalTokens,
          costUsd: gen.usage.estimatedCostUsd,
        };
      } catch (err) {
        log("warn", `AI provider call failed, falling back to deterministic idea generation: ${err}`);
      }
    }

    const angles: Array<"curiosity" | "contrarian" | "tutorial" | "case_study" | "relatable"> = [
      "curiosity",
      "contrarian",
      "tutorial",
      "case_study",
      "relatable",
    ];

    return {
      output: {
        ideas: Array.from({ length: input.count }, (_, i) => {
          const angle = angles[i % angles.length];
          return {
            title: `Ide Konten #${i + 1}: Rahasia Efisiensi di ${input.pillarName}`,
            hookAngle: angle,
            hookPreview: `Pernah gak ngerasa waktu habis sia-sia saat ngerjain ${input.pillarName}? Trik ini bakal ubah caramu.`,
            targetEmotion: angle === "curiosity" ? "penasaran" : "tercerahkan",
            estimatedPotentialScore: 85 + (i * 3) % 15,
          };
        }),
      },
      tokensUsed: 380,
      costUsd: 0.0001,
    };
  }
}
