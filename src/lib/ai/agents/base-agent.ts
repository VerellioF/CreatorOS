import { z } from "zod";

export interface AgentExecutionContext {
  workspaceId: string;
  userId?: string;
  runId?: string;
  stepIndex?: number;
  creatorDna?: {
    niche: string;
    tone: string[];
    archetype: string;
  };
  brandProfile?: {
    name?: string;
    voice?: string[];
  };
}

export interface AgentLogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentExecutionResult<TOutput> {
  status: "completed" | "failed";
  output: TOutput;
  tokensUsed: number;
  costUsd: number;
  creditsDeducted: number;
  durationMs: number;
  logs: AgentLogEntry[];
}

export interface BaseAgentConfig<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput, z.ZodTypeDef, any>;
  outputSchema: z.ZodType<TOutput, z.ZodTypeDef, any>;
  maxRetries?: number;
  timeoutMs?: number;
  defaultCredits?: number;
}

export abstract class BaseAgent<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput, z.ZodTypeDef, any>;
  readonly outputSchema: z.ZodType<TOutput, z.ZodTypeDef, any>;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly defaultCredits: number;

  constructor(config: BaseAgentConfig<TInput, TOutput>) {
    this.name = config.name;
    this.description = config.description;
    this.inputSchema = config.inputSchema;
    this.outputSchema = config.outputSchema;
    this.maxRetries = config.maxRetries ?? 2;
    this.timeoutMs = config.timeoutMs ?? 60000;
    this.defaultCredits = config.defaultCredits ?? 1;
  }

  /**
   * Concrete agents implement this method to carry out their generation logic.
   */
  protected abstract runInternal(
    input: TInput,
    context: AgentExecutionContext,
    log: (level: "info" | "warn" | "error" | "debug", message: string, meta?: Record<string, unknown>) => void
  ): Promise<{
    output: TOutput;
    tokensUsed?: number;
    costUsd?: number;
  }>;

  /**
   * Executes the agent with validation, retry policy, timeout policy, and logging.
   */
  async execute(
    rawInput: unknown,
    context: AgentExecutionContext
  ): Promise<AgentExecutionResult<TOutput>> {
    const startTime = Date.now();
    const logs: AgentLogEntry[] = [];

    const addLog = (
      level: "info" | "warn" | "error" | "debug",
      message: string,
      metadata?: Record<string, unknown>
    ) => {
      logs.push({
        level,
        message,
        timestamp: new Date().toISOString(),
        metadata,
      });
    };

    addLog("info", `[Agent: ${this.name}] Starting execution`, {
      workspaceId: context.workspaceId,
      stepIndex: context.stepIndex,
    });

    // 1. Validate typed input
    let validatedInput: TInput;
    try {
      validatedInput = this.inputSchema.parse(rawInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", `[Agent: ${this.name}] Input validation failed: ${msg}`);
      throw new Error(`Input validation failed for agent ${this.name}: ${msg}`);
    }

    // 2. Execution with retry policy & timeout
    let attempt = 0;
    let lastError: Error | null = null;
    let totalTokens = 0;
    let totalCost = 0;

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        addLog("debug", `[Agent: ${this.name}] Execution attempt ${attempt}/${this.maxRetries + 1}`);

        // Run with timeout race
        const result = await Promise.race([
          this.runInternal(validatedInput, context, addLog),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Agent ${this.name} timed out after ${this.timeoutMs}ms`)),
              this.timeoutMs
            )
          ),
        ]);

        // Validate typed output
        const validatedOutput = this.outputSchema.parse(result.output);
        totalTokens += result.tokensUsed || 0;
        totalCost += result.costUsd || 0;

        const durationMs = Date.now() - startTime;
        addLog("info", `[Agent: ${this.name}] Completed successfully in ${durationMs}ms`, {
          tokensUsed: totalTokens,
          costUsd: totalCost,
        });

        return {
          status: "completed",
          output: validatedOutput,
          tokensUsed: totalTokens,
          costUsd: totalCost,
          creditsDeducted: this.defaultCredits,
          durationMs,
          logs,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        addLog(
          "warn",
          `[Agent: ${this.name}] Attempt ${attempt} failed: ${lastError.message}${attempt <= this.maxRetries ? " (retrying)" : ""}`,
          {
            attempt,
            retrying: attempt <= this.maxRetries,
          }
        );

        if (attempt <= this.maxRetries) {
          // Exponential backoff jitter
          const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    addLog("error", `[Agent: ${this.name}] All ${this.maxRetries + 1} attempts failed. ${lastError?.message}`);
    throw lastError || new Error(`Agent ${this.name} execution failed.`);
  }
}
