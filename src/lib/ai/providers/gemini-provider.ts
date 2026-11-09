import { GoogleGenAI } from "@google/genai";
import { normalizeSupportedAiModel } from "@/lib/validation/workspace-schemas";
import {
  calculateUsageCostUsd,
  DEFAULT_AI_TIMEOUT_MS,
  estimateTokenCount,
} from "@/lib/ai/token-budget";
import {
  AiConfigurationError,
  cleanAndValidateApiKey,
  type GroundingCitation,
  type StructuredTextRequest,
  type StructuredTextResponse,
  type TextGenerationProvider,
} from "@/lib/ai/types";

function resolveGeminiModelId(requestedModel: string | undefined): string {
  const normalized = normalizeSupportedAiModel(requestedModel);
  if (normalized.startsWith("gemini-")) {
    return normalized;
  }
  return "gemini-3.8-flash";
}

export class GeminiProvider implements TextGenerationProvider {
  public readonly name = "gemini" as const;
  private readonly explicitApiKey?: string;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  private getApiKey(): string | null {
    return cleanAndValidateApiKey(
      this.explicitApiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
    );
  }

  public isConfigured(): boolean {
    return this.getApiKey() !== null;
  }

  public async generateStructuredJson(
    request: StructuredTextRequest
  ): Promise<StructuredTextResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new AiConfigurationError(
        "GEMINI_API_KEY belum dikonfigurasi pada server (.env.local)."
      );
    }

    const modelId = resolveGeminiModelId(request.model);
    const timeoutMs = request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    const maxOutputTokens = request.maxOutputTokens ?? 4096;

    const client = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const interaction = await client.interactions.create(
        {
          model: modelId,
          system_instruction: request.systemPrompt,
          input: request.userPrompt,
          ...(request.enableWebGrounding
            ? {
                tools: [{ type: "google_search" }, { type: "url_context" }],
              }
            : {}),
          generation_config: {
            max_output_tokens: maxOutputTokens,
            ...(request.thinkingLevel ? { thinking_level: request.thinkingLevel } : {}),
          },
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: request.jsonSchema,
          },
          store: false,
        },
        {
          signal: controller.signal,
        }
      );

      if (interaction.status === "failed" || interaction.status === "cancelled") {
        const errDetail =
          interaction.errors?.map((e) => e.message || e.code).join("; ") ||
          `Interaction ended with status: ${interaction.status}`;
        throw new Error(`Gemini Interactions API failed: ${errDetail}`);
      }

      let rawText = interaction.output_text?.trim() ?? "";
      const groundingCitations: GroundingCitation[] = [];
      const searchQueries: string[] = [];

      if (Array.isArray(interaction.steps)) {
        const textChunks: string[] = [];
        for (const step of interaction.steps) {
          if (
            step.type === "google_search_call" &&
            Array.isArray(step.arguments?.queries)
          ) {
            for (const q of step.arguments.queries) {
              if (typeof q === "string" && q.trim()) {
                searchQueries.push(q.trim());
              }
            }
          }

          if (step.type === "model_output" && Array.isArray(step.content)) {
            for (const block of step.content) {
              if (block.type === "text" && typeof block.text === "string") {
                if (!rawText) {
                  textChunks.push(block.text);
                }
                if (Array.isArray(block.annotations)) {
                  for (const ann of block.annotations) {
                    if (
                      ann.type === "url_citation" &&
                      typeof ann.url === "string" &&
                      ann.url.startsWith("http")
                    ) {
                      const start =
                        typeof ann.start_index === "number" ? ann.start_index : 0;
                      const end =
                        typeof ann.end_index === "number" ? ann.end_index : 0;
                      const citedText =
                        end > start && end <= block.text.length
                          ? block.text.slice(start, end)
                          : undefined;
                      groundingCitations.push({
                        url: ann.url,
                        title:
                          typeof ann.title === "string" && ann.title.trim()
                            ? ann.title.trim()
                            : ann.url,
                        citedText,
                      });
                    }
                  }
                }
              }
            }
          }
        }
        if (!rawText) {
          rawText = textChunks.join("").trim();
        }
      }

      if (!rawText) {
        throw new Error("Gemini Interactions API returned an empty response payload.");
      }

      const durationMs = Math.max(1, Date.now() - startedAt);
      const promptTokens =
        interaction.usage?.total_input_tokens ??
        estimateTokenCount(request.systemPrompt + "\n" + request.userPrompt);
      const completionTokens =
        interaction.usage?.total_output_tokens ?? estimateTokenCount(rawText);
      const totalTokens =
        interaction.usage?.total_tokens ?? promptTokens + completionTokens;

      return {
        rawText,
        usage: {
          provider: "gemini",
          modelId,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: calculateUsageCostUsd(modelId, promptTokens, completionTokens),
          durationMs,
        },
        groundingCitations,
        searchQueries,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
