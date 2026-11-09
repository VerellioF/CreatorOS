import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { InsufficientCreditsError } from "@/lib/ai/types";
import type { AiProviderUsageRow, CreditTransactionRow, CreditWalletRow, Json } from "@/lib/supabase/types";

export interface WorkspaceUsageOverview {
  balance: number;
  monthlyAllowance: number;
  totalTokensUsedRecent: number;
  totalCostUsdRecent: number;
  recentUsage: AiProviderUsageRow[];
  recentTransactions: CreditTransactionRow[];
}

export interface RecordAiUsageParams {
  workspaceId: string;
  userId: string;
  agentName: string;
  operationType: string;
  provider: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  creditsToDeduct: number;
  durationMs: number;
  status: "success" | "failed" | "fallback_success";
  inputSummary?: Record<string, Json>;
  outputSummary?: Record<string, Json> | null;
  errorDetails?: string | null;
}

export interface RecordedUsageResult {
  agentRunId: string | null;
  usageId: string | null;
  creditsDeducted: number;
  remainingBalance: number;
}

export class UsageBillingService {
  /**
   * Returns current workspace credit balance (defaults safely to 50 if table is not yet migrated in dev).
   */
  static async getWorkspaceCreditBalance(
    workspaceId: string,
    userId: string
  ): Promise<{ balance: number; monthlyAllowance: number }> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke kredit workspace ini.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("credit_wallets")
      .select("balance, monthly_allowance")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error || !data) {
      return { balance: 20, monthlyAllowance: 20 };
    }

    const row = data as Pick<CreditWalletRow, "balance" | "monthly_allowance">;
    return {
      balance: row.balance,
      monthlyAllowance: row.monthly_allowance,
    };
  }

  /**
   * Pre-execution credit check per AGENTS.md Rule 5 so external LLM tokens are never spent
   * when a workspace lacks credits.
   */
  static async assertSufficientCredits(
    workspaceId: string,
    userId: string,
    requiredCredits: number
  ): Promise<number> {
    const hasEditorAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!hasEditorAccess) {
      throw new Error(
        "Akses ditolak: peran Editor, Admin, atau Owner diperlukan untuk menjalankan operasi AI."
      );
    }

    const { balance } = await this.getWorkspaceCreditBalance(workspaceId, userId);
    if (requiredCredits > 0 && balance < requiredCredits) {
      throw new InsufficientCreditsError(requiredCredits, balance);
    }
    return balance;
  }

  /**
   * Atomically records `agent_runs`, `ai_provider_usage`, and `credit_transactions`
   * via validated PostgreSQL SECURITY DEFINER RPC `record_ai_usage_and_deduct_credits`.
   */
  static async recordExecutionUsage(
    params: RecordAiUsageParams
  ): Promise<RecordedUsageResult> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_ai_usage_and_deduct_credits", {
      target_workspace_id: params.workspaceId,
      p_agent_name: params.agentName,
      p_operation_type: params.operationType,
      p_provider: params.provider,
      p_model_id: params.modelId,
      p_prompt_tokens: Math.max(0, Math.round(params.promptTokens)),
      p_completion_tokens: Math.max(0, Math.round(params.completionTokens)),
      p_total_tokens: Math.max(0, Math.round(params.totalTokens)),
      p_cost_usd: Number(Math.max(0, params.costUsd).toFixed(6)),
      p_credits_to_deduct: Math.max(0, Math.round(params.creditsToDeduct)),
      p_duration_ms: Math.max(0, Math.round(params.durationMs)),
      p_status: params.status,
      p_input_summary: (params.inputSummary ?? {}) as Json,
      p_output_summary: (params.outputSummary ?? null) as Json | null,
      p_error_details: params.errorDetails ?? null,
    });

    if (error) {
      if (error.message.toLowerCase().includes("insufficient workspace credits")) {
        throw new InsufficientCreditsError(params.creditsToDeduct, 0);
      }
      throw new Error(`Gagal mencatat penggunaan AI: ${error.message}`);
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    return {
      agentRunId: typeof payload.agent_run_id === "string" ? payload.agent_run_id : null,
      usageId: typeof payload.usage_id === "string" ? payload.usage_id : null,
      creditsDeducted:
        typeof payload.credits_deducted === "number" ? payload.credits_deducted : 0,
      remainingBalance:
        typeof payload.remaining_balance === "number" ? payload.remaining_balance : 0,
    };
  }

  /**
   * Fetches transparent cost, token, and credit usage history for workspace UI display.
   */
  static async getWorkspaceUsageOverview(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceUsageOverview> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke data penggunaan workspace.");
    }

    const supabase = await createClient();
    const [{ data: walletData }, { data: usageData }] = await Promise.all([
      supabase
        .from("credit_wallets")
        .select("id, balance, monthly_allowance")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("ai_provider_usage")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const wallet = walletData as Pick<
      CreditWalletRow,
      "id" | "balance" | "monthly_allowance"
    > | null;
    const recentUsage = (usageData ?? []) as AiProviderUsageRow[];

    let recentTransactions: CreditTransactionRow[] = [];
    if (wallet?.id) {
      const { data: txData } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(10);
      recentTransactions = (txData ?? []) as CreditTransactionRow[];
    }

    const totalTokensUsedRecent = recentUsage.reduce(
      (acc, item) => acc + (item.total_tokens || 0),
      0
    );
    const totalCostUsdRecent = Number(
      recentUsage
        .reduce((acc, item) => acc + Number(item.cost_usd || 0), 0)
        .toFixed(6)
    );

    return {
      balance: wallet?.balance ?? 20,
      monthlyAllowance: wallet?.monthly_allowance ?? 20,
      totalTokensUsedRecent,
      totalCostUsdRecent,
      recentUsage,
      recentTransactions,
    };
  }
}
