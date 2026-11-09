import { BaseAgent, type AgentExecutionContext } from "./base-agent";
import {
  monetizationCoachInputSchema,
  monetizationCoachOutputSchema,
  type MonetizationCoachInput,
  type MonetizationCoachOutput,
} from "@/lib/validation/agent-schemas";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import { MONETIZATION_COACH_AGENT_JSON_SCHEMA } from "@/lib/ai/schemas/agent-json-schemas";

export class MonetizationCoachAgent extends BaseAgent<MonetizationCoachInput, MonetizationCoachOutput> {
  constructor() {
    super({
      name: "monetization_coach",
      description: "Analyzes creator audience and engagement to recommend realistic commercial funnels and sponsorship benchmarks",
      inputSchema: monetizationCoachInputSchema,
      outputSchema: monetizationCoachOutputSchema,
      maxRetries: 2,
      timeoutMs: 40000,
      defaultCredits: 1,
    });
  }

  protected async runInternal(
    input: MonetizationCoachInput,
    context: AgentExecutionContext,
    log: (level: "info" | "warn" | "error" | "debug", message: string) => void
  ): Promise<{ output: MonetizationCoachOutput; tokensUsed?: number; costUsd?: number }> {
    log("info", `Analyzing monetization opportunities for mode: ${input.creatorMode}, followers: ${input.currentFollowers}`);

    if (process.env.GEMINI_API_KEY && context.userId) {
      try {
        const prompt = `You are the Commercial Monetization Coach Agent for CreatorOS AI.
Creator Mode: ${input.creatorMode}
Follower Count: ${input.currentFollowers}
Average Views Per Post: ${input.avgViewsPerPost}

Provide realistic commercial benchmarks without making false income promises or get-rich-quick guarantees.
Recommend realistic affiliate product categories, high-converting digital product formats (ebook, notion_template, mini_course) priced in IDR, and fair market brand sponsorship rate ranges (IDR min & max).`;

        const gen = await executeValidatedStructuredGeneration<MonetizationCoachOutput>({
          workspaceId: context.workspaceId,
          userId: context.userId,
          agentName: "MonetizationCoachAgent",
          operationType: "niche_discovery_generation",
          systemPrompt: "You are an honest commercial talent manager and digital business strategist. Produce strict JSON only.",
          userPrompt: prompt,
          schemaName: "monetization_coach_agent_schema",
          jsonSchema: MONETIZATION_COACH_AGENT_JSON_SCHEMA as any,
          zodSchema: monetizationCoachOutputSchema,
        });

        return {
          output: gen.data,
          tokensUsed: gen.usage.totalTokens,
          costUsd: gen.usage.estimatedCostUsd,
        };
      } catch (err) {
        log("warn", `AI provider call failed, falling back to deterministic monetization benchmark: ${err}`);
      }
    }

    // Realistic Indonesian sponsorship rate calculation based on average views (CPM ~ 100k - 250k IDR per 1k views)
      const baseViewK = Math.max(1, Math.round(input.avgViewsPerPost / 1000));
      const minSponsorship = baseViewK * 120000;
      const maxSponsorship = baseViewK * 280000;

      return {
        output: {
          monetizationPotentialScore: Math.min(95, Math.max(50, Math.round(50 + Math.log10(input.avgViewsPerPost + 10) * 10))),
          recommendedAffiliateCategories: [
            "Software & SaaS Produktivitas",
            "Peralatan Studio Creator (Mic & Lighting)",
            "Buku & E-Course Pengembangan Diri",
          ],
          digitalProductIdeas: [
            {
              title: "Template Sistem Alur Kerja Creator (Notion)",
              format: "notion_template",
              targetPriceIdr: 79000,
            },
            {
              title: "Panduan Taktis Hook & Scriptwriting Short-Form",
              format: "ebook",
              targetPriceIdr: 99000,
            },
          ],
          estimatedSponsorshipRateIdr: {
            min: Math.max(500000, minSponsorship),
            max: Math.max(1200000, maxSponsorship),
          },
        },
        tokensUsed: 410,
        costUsd: 0.0001,
      };
  }
}
