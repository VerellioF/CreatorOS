import {
  normalizeSupportedAiModel,
  type SupportedAiModel,
} from "@/lib/validation/workspace-schemas";
import type { TokenBudgetEstimate } from "./types";

/**
 * Hard cap per AGENTS.md Rule 5: prevent recursive or unbounded agent loops.
 */
export const MAX_AGENT_TURNS_PER_TASK = 5;

export const DEFAULT_AI_TIMEOUT_MS = 45_000;

interface ModelRatePerMillionTokens {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

const MODEL_PRICING_TABLE: Record<SupportedAiModel, ModelRatePerMillionTokens> = {
  "gemini-3.5-flash-lite": { inputUsdPer1M: 0.1, outputUsdPer1M: 0.4 },
  "gemini-3.8-flash": { inputUsdPer1M: 0.3, outputUsdPer1M: 2.5 },
  "gemini-4-argon": { inputUsdPer1M: 1.25, outputUsdPer1M: 10.0 },
  "gpt-4o": { inputUsdPer1M: 2.5, outputUsdPer1M: 10.0 },
  "gpt-4o-mini": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
};

/**
 * Operation credit cost schedule (transparent workspace credit accounting).
 */
export const AI_OPERATION_CREDIT_COSTS = {
  adaptive_interview_questions: 1,
  creator_intelligence_synthesis: 3,
  niche_discovery_generation: 2,
  roadmap_regeneration: 2,
  trend_research_generation: 2,
  competitor_research_generation: 2,
  audience_research_generation: 2,
  content_strategy_generation: 3,
  content_idea_generation: 2,
  content_package_generation: 3,
  platform_content_adaptation: 2,
  storyboard_generation: 3,
  image_generation: 2,
  voice_generation: 2,
  video_generation: 5,
  timeline_export: 4,
  subtitle_generation: 1,
  analytics_diagnostics_generation: 0,
  ai_assistant_chat: 1,
} as const;

export type AiOperationType = keyof typeof AI_OPERATION_CREDIT_COSTS;

/**
 * Conservative token estimator (~3.5 UTF-8 bytes per token for mixed Bahasa Indonesia, English & JSON).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const byteLen = Buffer.byteLength(text, "utf8");
  return Math.max(1, Math.ceil(byteLen / 3.5));
}

export function calculateUsageCostUsd(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const normalized = normalizeSupportedAiModel(modelId);
  const rate = MODEL_PRICING_TABLE[normalized];
  const safePrompt = Math.max(0, promptTokens);
  const safeCompletion = Math.max(0, completionTokens);
  const totalUsd =
    (safePrompt / 1_000_000) * rate.inputUsdPer1M +
    (safeCompletion / 1_000_000) * rate.outputUsdPer1M;
  return Number(totalUsd.toFixed(6));
}

export function estimateOperationBudget(params: {
  systemPrompt: string;
  userPrompt: string;
  schemaJsonText: string;
  maxCompletionTokens: number;
  modelId?: string | null;
  requiredCredits: number;
}): TokenBudgetEstimate {
  const resolvedModel = normalizeSupportedAiModel(params.modelId);
  const estimatedPromptTokens =
    estimateTokenCount(params.systemPrompt) +
    estimateTokenCount(params.userPrompt) +
    estimateTokenCount(params.schemaJsonText) +
    48; // framing overhead

  const maxCompletionTokens = Math.max(128, Math.min(params.maxCompletionTokens, 8192));
  const estimatedMaxTotalTokens = estimatedPromptTokens + maxCompletionTokens;
  const estimatedMaxCostUsd = calculateUsageCostUsd(
    resolvedModel,
    estimatedPromptTokens,
    maxCompletionTokens
  );

  return {
    modelId: resolvedModel,
    estimatedPromptTokens,
    maxCompletionTokens,
    estimatedMaxTotalTokens,
    estimatedMaxCostUsd,
    requiredCredits: Math.max(0, params.requiredCredits),
    maxTurnsAllowed: MAX_AGENT_TURNS_PER_TASK,
  };
}

export function assertTurnWithinBudget(turnNumber: number): void {
  if (turnNumber < 1 || turnNumber > MAX_AGENT_TURNS_PER_TASK) {
    throw new Error(
      `AI execution halted: turn ${turnNumber} exceeds hard cap of ${MAX_AGENT_TURNS_PER_TASK} turns per task.`
    );
  }
}
