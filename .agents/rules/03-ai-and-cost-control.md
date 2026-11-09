# 03 - AI Provider Governance & Cost Control Protocol

## 1. Provider Independence
- Application domain logic MUST NOT import vendor SDKs (`@google/genai`, `openai`, `anthropic`) directly into UI or feature components.
- All AI calls must go through the typed provider abstraction layer in `src/lib/ai/`.
- Interfaces:
  - `TextGenerationProvider`
  - `ResearchProvider`
  - `ImageGenerationProvider`
  - `VideoGenerationProvider`
  - `SpeechGenerationProvider`

## 2. Token Budgeting & Estimation
- Before dispatching an LLM generation or agent run, compute estimated token requirements.
- Verify that the target workspace has sufficient balance in `credit_wallets`.
- Disallow execution if credit balance is insufficient, notifying the user with an upgrade/top-up dialog.

## 3. Cost & Telemetry Logging
- Record every AI execution in the `ai_provider_usage` table:
  - `workspace_id`, `user_id`
  - `provider_name` (e.g., 'gemini', 'openai')
  - `model_id` (e.g., 'gemini-1.5-pro', 'gpt-4o')
  - `prompt_tokens`, `completion_tokens`, `total_tokens`
  - `estimated_cost_usd`
  - `duration_ms`
  - `status` ('success', 'failed', 'fallback_used')

## 4. Fallback & Resilience Strategy
- If a primary provider returns a rate limit (HTTP 429) or transient 5xx, execute configured fallback adapter (e.g., Gemini 1.5 Pro -> OpenAI GPT-4o).
- Max retry count: 2 with exponential backoff and jitter.
- Hard timeout on LLM requests: 45 seconds for streaming/interactive, 120 seconds for batch background jobs.
