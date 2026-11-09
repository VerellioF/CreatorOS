import type { SupportedAiModel } from "@/lib/validation/workspace-schemas";

export type AiProviderName = "gemini" | "openai";

export type ThinkingLevelOption = "minimal" | "low" | "medium" | "high";

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  enum?: readonly string[];
  items?: JsonSchemaProperty;
  properties?: Readonly<Record<string, JsonSchemaProperty>>;
  required?: readonly string[];
}

export interface JsonSchemaObject {
  type: "object";
  description?: string;
  properties: Readonly<Record<string, JsonSchemaProperty>>;
  required: readonly string[];
}

export interface GroundingCitation {
  url: string;
  title: string;
  citedText?: string;
}

export interface StructuredTextRequest {
  model?: SupportedAiModel;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: JsonSchemaObject;
  maxOutputTokens?: number;
  thinkingLevel?: ThinkingLevelOption;
  timeoutMs?: number;
  enableWebGrounding?: boolean;
}

export interface ProviderUsageMetrics {
  provider: AiProviderName;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
}

export interface StructuredTextResponse {
  rawText: string;
  usage: ProviderUsageMetrics;
  groundingCitations?: GroundingCitation[];
  searchQueries?: string[];
}

export interface TextGenerationProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  generateStructuredJson(request: StructuredTextRequest): Promise<StructuredTextResponse>;
}

export interface ProviderAvailabilityStatus {
  geminiConfigured: boolean;
  openaiConfigured: boolean;
  anyConfigured: boolean;
  activePrimaryProvider: AiProviderName | null;
}

export interface TokenBudgetEstimate {
  modelId: SupportedAiModel;
  estimatedPromptTokens: number;
  maxCompletionTokens: number;
  estimatedMaxTotalTokens: number;
  estimatedMaxCostUsd: number;
  requiredCredits: number;
  maxTurnsAllowed: number;
}

export class AiConfigurationError extends Error {
  public readonly code = "AI_PROVIDER_NOT_CONFIGURED";
  constructor(
    message = "API key AI provider (GEMINI_API_KEY atau OPENAI_API_KEY) belum dikonfigurasi pada server (.env.local)."
  ) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export class InsufficientCreditsError extends Error {
  public readonly code = "INSUFFICIENT_CREDITS";
  public readonly requiredCredits: number;
  public readonly availableCredits: number;

  constructor(requiredCredits: number, availableCredits: number) {
    super(
      `Kredit workspace tidak mencukupi. Dibutuhkan ${requiredCredits} kredit, tersedia ${availableCredits} kredit.`
    );
    this.name = "InsufficientCreditsError";
    this.requiredCredits = requiredCredits;
    this.availableCredits = availableCredits;
  }
}

export class AiSchemaValidationError extends Error {
  public readonly code = "AI_SCHEMA_VALIDATION_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "AiSchemaValidationError";
  }
}

/**
 * Strips accidental surrounding quotes/whitespace in `.env.local` values
 * and verifies that an API key is a real non-placeholder credential.
 */
export function cleanAndValidateApiKey(rawKey: string | undefined): string | null {
  if (!rawKey) return null;
  const cleaned = rawKey.trim().replace(/^["']+|["']+$/g, "").trim();
  if (cleaned.length < 12) return null;
  if (/^(your[-_]|placeholder|example|dummy|change[-_]?me|xxx|<|>)/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}
