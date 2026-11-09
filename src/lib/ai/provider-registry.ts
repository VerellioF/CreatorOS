import type { z } from "zod";
import { normalizeSupportedAiModel, type SupportedAiModel } from "@/lib/validation/workspace-schemas";
import {
  AI_OPERATION_CREDIT_COSTS,
  assertTurnWithinBudget,
  estimateOperationBudget,
  type AiOperationType,
} from "@/lib/ai/token-budget";
import {
  AiConfigurationError,
  AiSchemaValidationError,
  type GroundingCitation,
  type JsonSchemaObject,
  type ProviderAvailabilityStatus,
  type ProviderUsageMetrics,
  type TextGenerationProvider,
  type ThinkingLevelOption,
  type TokenBudgetEstimate,
} from "@/lib/ai/types";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { OpenAiProvider } from "@/lib/ai/providers/openai-provider";
import { UsageBillingService, type RecordedUsageResult } from "@/services/usage-billing-service";
import type { Json } from "@/lib/supabase/types";

export interface ValidatedGenerationOptions<TOutput> {
  workspaceId: string;
  userId: string;
  agentName: string;
  operationType: AiOperationType;
  preferredModel?: string | null;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: JsonSchemaObject;
  zodSchema: z.ZodType<TOutput, z.ZodTypeDef, unknown>;
  maxOutputTokens?: number;
  thinkingLevel?: ThinkingLevelOption;
  timeoutMs?: number;
  enableWebGrounding?: boolean;
  inputSummary?: Record<string, Json>;
  /**
   * Optional dependency injection hook for unit/integration tests.
   */
  customProviders?: {
    primary?: TextGenerationProvider;
    fallback?: TextGenerationProvider;
  };
}

export interface ValidatedGenerationResult<TOutput> {
  data: TOutput;
  usage: ProviderUsageMetrics;
  budgetEstimate: TokenBudgetEstimate;
  billing: RecordedUsageResult;
  usedFallback: boolean;
  groundingCitations: GroundingCitation[];
  searchQueries: string[];
}

function stripMarkdownJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch?.[1]?.trim() ?? trimmed;
}

export function getProviderAvailability(custom?: {
  gemini?: TextGenerationProvider;
  openai?: TextGenerationProvider;
}): ProviderAvailabilityStatus {
  const gemini = custom?.gemini ?? new GeminiProvider();
  const openai = custom?.openai ?? new OpenAiProvider();
  const geminiConfigured = gemini.isConfigured();
  const openaiConfigured = openai.isConfigured();

  return {
    geminiConfigured,
    openaiConfigured,
    anyConfigured: geminiConfigured || openaiConfigured,
    activePrimaryProvider: geminiConfigured
      ? "gemini"
      : openaiConfigured
        ? "openai"
        : null,
  };
}

function resolveOrderedProviders(
  preferredModel: SupportedAiModel,
  customProviders?: {
    primary?: TextGenerationProvider;
    fallback?: TextGenerationProvider;
  }
): TextGenerationProvider[] {
  if (customProviders?.primary || customProviders?.fallback) {
    return [customProviders.primary, customProviders.fallback].filter(
      (p): p is TextGenerationProvider => Boolean(p && p.isConfigured())
    );
  }

  const gemini = new GeminiProvider();
  const openai = new OpenAiProvider();
  const ordered = preferredModel.startsWith("gpt-")
    ? [openai, gemini]
    : [gemini, openai];

  return ordered.filter((provider) => provider.isConfigured());
}

/**
 * Unified AI Orchestration Gateway:
 * 1. Verifies provider configuration (no fake mocked responses).
 * 2. Estimates token & USD budget pre-execution (Rule 5).
 * 3. Verifies workspace credit balance before calling external APIs.
 * 4. Enforces bounded retries + primary->fallback failover within hard 5-turn cap.
 * 5. Parses and validates LLM JSON strictly against Zod schema (Rule 2).
 * 6. Atomically logs telemetry in `ai_provider_usage` + `agent_runs` and deducts credits.
 */
export async function executeValidatedStructuredGeneration<TOutput>(
  options: ValidatedGenerationOptions<TOutput>
): Promise<ValidatedGenerationResult<TOutput>> {
  const preferredModel = normalizeSupportedAiModel(options.preferredModel);
  const providers = resolveOrderedProviders(preferredModel, options.customProviders);

  if (providers.length === 0) {
    throw new AiConfigurationError();
  }

  const requiredCredits = AI_OPERATION_CREDIT_COSTS[options.operationType];
  const maxOutputTokens = options.maxOutputTokens ?? 4096;

  // Step 1: Pre-execution token & USD cost estimation (Rule 5)
  const budgetEstimate = estimateOperationBudget({
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
    schemaJsonText: JSON.stringify(options.jsonSchema),
    maxCompletionTokens: maxOutputTokens,
    modelId: preferredModel,
    requiredCredits,
  });

  // Step 2: Pre-execution workspace credit check
  await UsageBillingService.assertSufficientCredits(
    options.workspaceId,
    options.userId,
    requiredCredits
  );

  let turnCount = 0;
  let lastError: Error | null = null;
  let accumulatedPromptTokens = 0;
  let accumulatedCompletionTokens = 0;
  let accumulatedTotalTokens = 0;
  let accumulatedCostUsd = 0;
  let accumulatedDurationMs = 0;

  for (let providerIdx = 0; providerIdx < providers.length; providerIdx++) {
    const provider = providers[providerIdx]!;
    const isFallbackProvider = providerIdx > 0;
    const maxAttemptsForProvider = 2;

    for (let attempt = 1; attempt <= maxAttemptsForProvider; attempt++) {
      turnCount += 1;
      assertTurnWithinBudget(turnCount);

      try {
        const response = await provider.generateStructuredJson({
          model: preferredModel,
          systemPrompt: options.systemPrompt,
          userPrompt:
            attempt === 1
              ? options.userPrompt
              : `${options.userPrompt}\n\nCATATAN PERBAIKAN SCHEMA: Pastikan seluruh properti wajib pada JSON Schema terisi lengkap dan patuh format tanpa teks di luar JSON.`,
          schemaName: options.schemaName,
          jsonSchema: options.jsonSchema,
          maxOutputTokens,
          thinkingLevel: options.thinkingLevel,
          timeoutMs: options.timeoutMs,
          enableWebGrounding: options.enableWebGrounding,
        });

        accumulatedPromptTokens += response.usage.promptTokens;
        accumulatedCompletionTokens += response.usage.completionTokens;
        accumulatedTotalTokens += response.usage.totalTokens;
        accumulatedCostUsd = Number(
          (accumulatedCostUsd + response.usage.estimatedCostUsd).toFixed(6)
        );
        accumulatedDurationMs += response.usage.durationMs;

        const cleanedJsonText = stripMarkdownJsonFences(response.rawText);
        let parsedRaw: unknown;
        try {
          parsedRaw = JSON.parse(cleanedJsonText);
        } catch (jsonErr) {
          throw new AiSchemaValidationError(
            `Respons AI bukan JSON valid: ${(jsonErr as Error).message}`
          );
        }

        const validated = options.zodSchema.safeParse(parsedRaw);
        if (!validated.success) {
          const issuesSummary = validated.error.issues
            .slice(0, 4)
            .map((iss) => `${iss.path.join(".") || "root"}: ${iss.message}`)
            .join("; ");
          throw new AiSchemaValidationError(
            `Validasi skema Zod gagal (${options.schemaName}): ${issuesSummary}`
          );
        }

        const aggregatedUsage: ProviderUsageMetrics = {
          provider: response.usage.provider,
          modelId: response.usage.modelId,
          promptTokens: accumulatedPromptTokens,
          completionTokens: accumulatedCompletionTokens,
          totalTokens: accumulatedTotalTokens,
          estimatedCostUsd: accumulatedCostUsd,
          durationMs: accumulatedDurationMs,
        };

        const billing = await UsageBillingService.recordExecutionUsage({
          workspaceId: options.workspaceId,
          userId: options.userId,
          agentName: options.agentName,
          operationType: options.operationType,
          provider: aggregatedUsage.provider,
          modelId: aggregatedUsage.modelId,
          promptTokens: aggregatedUsage.promptTokens,
          completionTokens: aggregatedUsage.completionTokens,
          totalTokens: aggregatedUsage.totalTokens,
          costUsd: aggregatedUsage.estimatedCostUsd,
          creditsToDeduct: requiredCredits,
          durationMs: aggregatedUsage.durationMs,
          status: isFallbackProvider ? "fallback_success" : "success",
          inputSummary: options.inputSummary,
          outputSummary: {
            schema: options.schemaName,
            turns: turnCount,
          },
        });

        return {
          data: validated.data,
          usage: aggregatedUsage,
          budgetEstimate,
          billing,
          usedFallback: isFallbackProvider,
          groundingCitations: response.groundingCitations ?? [],
          searchQueries: response.searchQueries ?? [],
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  // Record failed attempt with 0 credit deduction for auditability
  try {
    await UsageBillingService.recordExecutionUsage({
      workspaceId: options.workspaceId,
      userId: options.userId,
      agentName: options.agentName,
      operationType: options.operationType,
      provider: providers[0]!.name,
      modelId: preferredModel,
      promptTokens: accumulatedPromptTokens || budgetEstimate.estimatedPromptTokens,
      completionTokens: accumulatedCompletionTokens,
      totalTokens:
        accumulatedTotalTokens || budgetEstimate.estimatedPromptTokens,
      costUsd: accumulatedCostUsd,
      creditsToDeduct: 0,
      durationMs: Math.max(1, accumulatedDurationMs),
      status: "failed",
      inputSummary: options.inputSummary,
      outputSummary: null,
      errorDetails: lastError?.message ?? "Unknown AI provider failure",
    });
  } catch {
    // Preserve primary execution error if telemetry write also fails
  }

  throw lastError ?? new Error("Eksekusi AI gagal setelah mencoba seluruh provider.");
}
