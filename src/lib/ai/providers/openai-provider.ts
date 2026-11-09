import {
  calculateUsageCostUsd,
  DEFAULT_AI_TIMEOUT_MS,
  estimateTokenCount,
} from "@/lib/ai/token-budget";
import {
  AiConfigurationError,
  cleanAndValidateApiKey,
  type StructuredTextRequest,
  type StructuredTextResponse,
  type TextGenerationProvider,
} from "@/lib/ai/types";

interface OpenAiChatCompletionPayload {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

function resolveOpenAiModelId(requestedModel: string | undefined): "gpt-4o" | "gpt-4o-mini" {
  if (requestedModel === "gpt-4o-mini" || requestedModel === "gemini-3.5-flash-lite") {
    return "gpt-4o-mini";
  }
  return "gpt-4o";
}

export class OpenAiProvider implements TextGenerationProvider {
  public readonly name = "openai" as const;
  private readonly explicitApiKey?: string;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  private getApiKey(): string | null {
    return cleanAndValidateApiKey(this.explicitApiKey ?? process.env.OPENAI_API_KEY);
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
        "OPENAI_API_KEY belum dikonfigurasi pada server (.env.local)."
      );
    }

    const modelId = resolveOpenAiModelId(request.model);
    const timeoutMs = request.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
    const maxOutputTokens = request.maxOutputTokens ?? 4096;

    const schemaInstruction = `${request.systemPrompt}\n\nPENTING: Kembalikan HANYA objek JSON valid yang mematuhi JSON Schema berikut (${request.schemaName}):\n${JSON.stringify(request.jsonSchema)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: schemaInstruction },
            { role: "user", content: request.userPrompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: maxOutputTokens,
        }),
        signal: controller.signal,
      });

      const data = (await response.json()) as OpenAiChatCompletionPayload;

      if (!response.ok) {
        throw new Error(
          `OpenAI API error (${response.status}): ${data.error?.message || response.statusText}`
        );
      }

      const rawText = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!rawText) {
        throw new Error("OpenAI API returned an empty completion payload.");
      }

      const durationMs = Math.max(1, Date.now() - startedAt);
      const promptTokens =
        data.usage?.prompt_tokens ??
        estimateTokenCount(schemaInstruction + "\n" + request.userPrompt);
      const completionTokens =
        data.usage?.completion_tokens ?? estimateTokenCount(rawText);
      const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

      return {
        rawText,
        usage: {
          provider: "openai",
          modelId,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: calculateUsageCostUsd(modelId, promptTokens, completionTokens),
          durationMs,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
