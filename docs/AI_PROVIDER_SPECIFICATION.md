# AI PROVIDER SPECIFICATION & ABSTRACTION ARCHITECTURE

## 1. DESIGN OBJECTIVE & DEPENDENCY INVERSION

The application layer must NEVER couple directly to a third-party vendor SDK. All generative and analytical operations are accessed through standardized, typed provider interfaces.

Benefits:
- Seamless zero-downtime provider switching (e.g. Gemini 1.5 Pro to OpenAI GPT-4o).
- Automated fallback policies upon rate limits (HTTP 429) or transient 5xx server errors.
- Unified cost accounting, token metering, and latency tracking.
- Secure credential boundaries (API keys reside exclusively in server environments).

---

## 2. CORE PROVIDER INTERFACES

### 2.1 Base Provider Contract
```typescript
export interface BaseProviderConfig {
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ProviderUsageReport {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  modelId: string;
}

export interface ProviderCapability {
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
}
```

### 2.2 Text Generation Provider
```typescript
export interface TextGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: "text" | "json_object";
  jsonSchema?: Record<string, unknown>;
}

export interface TextGenerationResult {
  content: string;
  parsed?: unknown;
  usage: ProviderUsageReport;
}

export interface TextGenerationProvider {
  id: string;
  name: string;
  getCapabilities(modelId: string): ProviderCapability;
  generateText(prompt: string, options?: TextGenerateOptions): Promise<TextGenerationResult>;
  generateStream(prompt: string, options?: TextGenerateOptions): AsyncIterable<string>;
}
```

### 2.3 Research Provider
```typescript
export interface ResearchSearchOptions {
  maxResults?: number;
  includeCitations?: boolean;
  searchRecencyFilter?: "day" | "week" | "month" | "year";
}

export interface ResearchCitation {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface ResearchResult {
  answer: string;
  citations: ResearchCitation[];
  usage: ProviderUsageReport;
}

export interface ResearchProvider {
  id: string;
  search(query: string, options?: ResearchSearchOptions): Promise<ResearchResult>;
}
```

### 2.4 Image Generation Provider
```typescript
export interface ImageGenerateOptions {
  aspectRatio: "1:1" | "16:9" | "9:16" | "4:5";
  style?: "photorealistic" | "cinematic" | "digital_art" | "minimalist";
  negativePrompt?: string;
  numberOfImages?: number;
}

export interface ImageGenerationResult {
  imageUrls: string[];
  usage: ProviderUsageReport;
}

export interface ImageGenerationProvider {
  id: string;
  generateImages(prompt: string, options?: ImageGenerateOptions): Promise<ImageGenerationResult>;
}
```

### 2.5 Speech Generation Provider (TTS)
```typescript
export interface SpeechGenerateOptions {
  voiceId: string;
  language: "id" | "en";
  stability?: number;
  similarityBoost?: number;
}

export interface SpeechGenerationResult {
  audioBuffer: Buffer;
  durationSeconds: number;
  usage: ProviderUsageReport;
}

export interface SpeechGenerationProvider {
  id: string;
  generateSpeech(text: string, options: SpeechGenerateOptions): Promise<SpeechGenerationResult>;
}
```

### 2.6 Video Generation Provider
```typescript
export interface VideoGenerateOptions {
  aspectRatio: "9:16" | "16:9";
  durationSeconds: 5 | 10;
  motionScore?: number;
}

export interface VideoGenerationResult {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
  usage: ProviderUsageReport;
}

export interface VideoGenerationProvider {
  id: string;
  submitVideoJob(prompt: string, options?: VideoGenerateOptions): Promise<VideoGenerationResult>;
  checkJobStatus(jobId: string): Promise<VideoGenerationResult>;
}
```

---

## 3. PROVIDER ADAPTER IMPLEMENTATIONS

| Capability | Primary Adapter | Fallback Adapter |
| :--- | :--- | :--- |
| **Text Generation** | Google Gemini 1.5 Pro / Flash (`@google/genai`) | OpenAI GPT-4o / GPT-4o-mini |
| **Research Search** | Perplexity Sonar API / Google Search Grounding | Serper / Tavily Search |
| **Image Generation** | Google Imagen 3 (`google-genai`) | Flux / Stable Diffusion (Replicate) |
| **Speech Generation** | ElevenLabs API (Indonesian & Multilingual v2) | OpenAI TTS-1-HD |
| **Video Generation** | Runway Gen-3 Alpha API | Luma Dream Machine API |

---

## 4. ERROR HANDLING & FALLBACK POLICY

1. **Retry Strategy:**
   - 429 (Rate Limit): Exponential backoff with full jitter (initial 1.5s, max 8s).
   - 5xx (Server Error): 1 retry before triggering configured fallback provider.
   - 400 (Bad Request): Immediate failure without retry; logs error details for debugging.
2. **Circuit Breaker:**
   - If a provider encounters 5 consecutive failures within a 60-second window, mark as degraded for 3 minutes and route all traffic to the fallback adapter.
3. **Cost Recording:**
   - All executions (successful or failed with partial usage) record exact token consumption into `ai_provider_usage`.
