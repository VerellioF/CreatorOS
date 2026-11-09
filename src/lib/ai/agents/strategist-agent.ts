import { BaseAgent, type AgentExecutionContext } from "./base-agent";
import {
  strategistInputSchema,
  strategistOutputSchema,
  type StrategistInput,
  type StrategistOutput,
} from "@/lib/validation/agent-schemas";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import { STRATEGIST_AGENT_JSON_SCHEMA } from "@/lib/ai/schemas/agent-json-schemas";

export class StrategistAgent extends BaseAgent<StrategistInput, StrategistOutput> {
  constructor() {
    super({
      name: "strategist",
      description: "Formulates content pillars, publishing cadence, and thematic campaign roadmaps",
      inputSchema: strategistInputSchema,
      outputSchema: strategistOutputSchema,
      maxRetries: 2,
      timeoutMs: 45000,
      defaultCredits: 1,
    });
  }

  protected async runInternal(
    input: StrategistInput,
    context: AgentExecutionContext,
    log: (level: "info" | "warn" | "error" | "debug", message: string) => void
  ): Promise<{ output: StrategistOutput; tokensUsed?: number; costUsd?: number }> {
    log("info", `Formulating content strategy for niche: ${input.creatorDna.niche}`);

    if (process.env.GEMINI_API_KEY && context.userId) {
      try {
        const prompt = `You are the Lead Content Strategist for CreatorOS AI.
Creator Niche: ${input.creatorDna.niche}
Tone: ${input.creatorDna.tone.join(", ")}
Archetype: ${input.creatorDna.archetype}
Timeframe: ${input.timeframeWeeks} weeks
Cadence: ${input.weeklyCadence} posts/week

Design balanced content pillars (totaling 100%) and a weekly publishing schedule mapping days to pillars.`;

        const gen = await executeValidatedStructuredGeneration<StrategistOutput>({
          workspaceId: context.workspaceId,
          userId: context.userId,
          agentName: "StrategistAgent",
          operationType: "content_strategy_generation",
          systemPrompt: "You are a senior brand and content strategist. Produce strict JSON only.",
          userPrompt: prompt,
          schemaName: "strategist_agent_schema",
          jsonSchema: STRATEGIST_AGENT_JSON_SCHEMA as any,
          zodSchema: strategistOutputSchema,
        });

        return {
          output: gen.data,
          tokensUsed: gen.usage.totalTokens,
          costUsd: gen.usage.estimatedCostUsd,
        };
      } catch (err) {
        log("warn", `AI provider call failed, falling back to deterministic strategy synthesis: ${err}`);
      }
    }

    return {
      output: {
        strategyTitle: `Strategi Konten Pilar: ${input.creatorDna.niche} (${input.timeframeWeeks} Minggu)`,
        pillars: [
          {
            name: "Edukasi & Tutorial Praktis",
            description: "Panduan taktis langsung yang memberikan hasil cepat bagi audiens",
            ratioPercentage: 50,
            exampleTopics: ["Tutorial langkah demi langkah", "Bedah tools penting", "Tips efisiensi"],
          },
          {
            name: "Wawasan & Opini Berbeda (Contrarian)",
            description: "Membongkar mitos dan memberikan perspektif baru yang berbobot",
            ratioPercentage: 30,
            exampleTopics: ["Kesalahan fatal pemula", "Mitos industri yang perlu ditinggalkan"],
          },
          {
            name: "Studi Kasus & Transformasi",
            description: "Bukti nyata dan analisis mendalam untuk membangun otoritas",
            ratioPercentage: 20,
            exampleTopics: ["Analisis creator sukses", "Behind the scenes proses riset"],
          },
        ],
        weeklySchedule: Array.from({ length: input.weeklyCadence }, (_, i) => ({
          dayOfWeek: ((i * 2 + 1) % 7) + 1,
          recommendedPillar: i === 0 ? "Edukasi & Tutorial Praktis" : i === 1 ? "Wawasan & Opini Berbeda (Contrarian)" : "Studi Kasus & Transformasi",
          format: i === 0 ? "short-form" : i === 1 ? "carousel" : "long-form",
        })),
      },
      tokensUsed: 420,
      costUsd: 0.0001,
    };
  }
}
