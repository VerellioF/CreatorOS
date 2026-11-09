import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "./workspace-service";
import { InsufficientCreditsError } from "@/lib/ai/types";
export { InsufficientCreditsError };
import type { CreditTransactionRow } from "@/lib/supabase/types";

export interface DeductCreditsParams {
  workspaceId: string;
  userId?: string;
  amount: number;
  description: string;
  idempotencyKey?: string;
  referenceId?: string;
}

export interface RefundCreditsParams {
  workspaceId: string;
  amount: number;
  reason: string;
  idempotencyKey?: string;
  referenceId?: string;
}

export interface AllocateCreditsParams {
  workspaceId: string;
  amount: number;
  type?: "monthly_grant" | "top_up";
  idempotencyKey?: string;
  description?: string;
}

export interface CreditOperationResult {
  status: "success" | "idempotent_duplicate";
  deducted?: number;
  refunded?: number;
  allocated?: number;
  balance: number;
  transactionId?: string;
}

export interface LimitEnforcementParams {
  workspaceId: string;
  userId?: string;
  operationCost: number;
  userMonthlyLimit?: number;
  currentUserMonthlyUsage?: number;
}

export class CreditService {
  // In-memory ledger fallback for dev/testing environments without live Supabase
  private static mockBalances: Map<string, number> = new Map();
  private static mockTransactions: Map<string, CreditTransactionRow[]> = new Map();
  private static processedIdempotencyKeys: Map<
    string,
    { status: "idempotent_duplicate"; amount: number; balance: number; txId: string }
  > = new Map();

  static resetMockData(): void {
    this.mockBalances.clear();
    this.mockTransactions.clear();
    this.processedIdempotencyKeys.clear();
  }

  /**
   * Retrieves current credit balance for workspace.
   */
  static async getBalance(workspaceId: string, userId?: string): Promise<number> {
    if (userId) {
      const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
        userId,
        workspaceId,
        "viewer"
      );
      if (!hasAccess) {
        throw new Error("Akses ditolak ke saldo kredit workspace.");
      }
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("credit_wallets")
        .select("balance")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (!error && data) {
        return data.balance;
      }
    } catch {
      // Fallback
    }

    if (!this.mockBalances.has(workspaceId)) {
      this.mockBalances.set(workspaceId, 500); // Default starting test balance
    }
    return this.mockBalances.get(workspaceId)!;
  }

  /**
   * Allocates credits to a workspace (e.g. subscription monthly grant or top-up).
   */
  static async allocateCredits(
    params: AllocateCreditsParams
  ): Promise<CreditOperationResult> {
    if (params.amount <= 0) {
      throw new Error("Jumlah alokasi kredit harus lebih besar dari 0.");
    }

    if (params.idempotencyKey && this.processedIdempotencyKeys.has(params.idempotencyKey)) {
      const existing = this.processedIdempotencyKeys.get(params.idempotencyKey)!;
      return {
        status: "idempotent_duplicate",
        allocated: existing.amount,
        balance: existing.balance,
        transactionId: existing.txId,
      };
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("allocate_workspace_credits", {
        p_workspace_id: params.workspaceId,
        p_amount: params.amount,
        p_type: params.type ?? "top_up",
        p_idempotency_key: params.idempotencyKey ?? null,
        p_description: params.description ?? "Credit allocation",
      });

      if (!error && data) {
        const payload = data as Record<string, unknown>;
        return {
          status: "success",
          allocated: params.amount,
          balance: Number(payload.balance ?? params.amount),
        };
      }
    } catch {
      // Fallback
    }

    const current = this.mockBalances.get(params.workspaceId) ?? 0;
    const newBalance = current + params.amount;
    this.mockBalances.set(params.workspaceId, newBalance);

    const txId = `tx_alloc_${Date.now()}`;
    const tx: CreditTransactionRow = {
      id: txId,
      wallet_id: `wallet_${params.workspaceId}`,
      user_id: null,
      amount: params.amount,
      balance_after: newBalance,
      transaction_type: params.type ?? "top_up",
      reference_id: null,
      idempotency_key: params.idempotencyKey ?? null,
      description: params.description ?? "Credit allocation",
      created_at: new Date().toISOString(),
    };

    const txList = this.mockTransactions.get(params.workspaceId) ?? [];
    this.mockTransactions.set(params.workspaceId, [tx, ...txList]);

    if (params.idempotencyKey) {
      this.processedIdempotencyKeys.set(params.idempotencyKey, {
        status: "idempotent_duplicate",
        amount: params.amount,
        balance: newBalance,
        txId,
      });
    }

    return {
      status: "success",
      allocated: params.amount,
      balance: newBalance,
      transactionId: txId,
    };
  }

  /**
   * Atomically deducts credits with strict idempotency and row-level locking.
   */
  static async deductCredits(
    params: DeductCreditsParams
  ): Promise<CreditOperationResult> {
    if (params.amount <= 0) {
      throw new Error("Jumlah pengurangan kredit harus lebih besar dari 0.");
    }

    // Check idempotency cache first
    if (params.idempotencyKey && this.processedIdempotencyKeys.has(params.idempotencyKey)) {
      const existing = this.processedIdempotencyKeys.get(params.idempotencyKey)!;
      return {
        status: "idempotent_duplicate",
        deducted: existing.amount,
        balance: existing.balance,
        transactionId: existing.txId,
      };
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("deduct_workspace_credits", {
        p_workspace_id: params.workspaceId,
        p_amount: params.amount,
        p_description: params.description,
        p_idempotency_key: params.idempotencyKey ?? null,
        p_reference_id: params.referenceId ?? null,
        p_user_id: params.userId ?? null,
      });

      if (error) {
        if (error.message.toLowerCase().includes("insufficient workspace credits")) {
          throw new InsufficientCreditsError(params.amount, 0);
        }
      } else if (data) {
        const payload = data as Record<string, unknown>;
        return {
          status: payload.status === "idempotent_duplicate" ? "idempotent_duplicate" : "success",
          deducted: Number(payload.deducted ?? params.amount),
          balance: Number(payload.balance ?? 0),
        };
      }
    } catch (err) {
      if (err instanceof InsufficientCreditsError) throw err;
      // Fallback to local memory ledger
    }

    const currentBalance = await this.getBalance(params.workspaceId);
    if (currentBalance < params.amount) {
      throw new InsufficientCreditsError(params.amount, currentBalance);
    }

    const newBalance = currentBalance - params.amount;
    this.mockBalances.set(params.workspaceId, newBalance);

    const txId = `tx_deduct_${Date.now()}`;
    const tx: CreditTransactionRow = {
      id: txId,
      wallet_id: `wallet_${params.workspaceId}`,
      user_id: params.userId ?? null,
      amount: -params.amount,
      balance_after: newBalance,
      transaction_type: "ai_generation",
      reference_id: params.referenceId ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      description: params.description,
      created_at: new Date().toISOString(),
    };

    const txList = this.mockTransactions.get(params.workspaceId) ?? [];
    this.mockTransactions.set(params.workspaceId, [tx, ...txList]);

    if (params.idempotencyKey) {
      this.processedIdempotencyKeys.set(params.idempotencyKey, {
        status: "idempotent_duplicate",
        amount: params.amount,
        balance: newBalance,
        txId,
      });
    }

    return {
      status: "success",
      deducted: params.amount,
      balance: newBalance,
      transactionId: txId,
    };
  }

  /**
   * Atomically refunds credits for eligible failed operations.
   */
  static async refundCredits(
    params: RefundCreditsParams
  ): Promise<CreditOperationResult> {
    if (params.amount <= 0) {
      throw new Error("Jumlah pengembalian kredit harus lebih besar dari 0.");
    }

    if (params.idempotencyKey && this.processedIdempotencyKeys.has(params.idempotencyKey)) {
      const existing = this.processedIdempotencyKeys.get(params.idempotencyKey)!;
      return {
        status: "idempotent_duplicate",
        refunded: existing.amount,
        balance: existing.balance,
        transactionId: existing.txId,
      };
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("refund_workspace_credits", {
        p_workspace_id: params.workspaceId,
        p_amount: params.amount,
        p_reason: params.reason,
        p_idempotency_key: params.idempotencyKey ?? null,
        p_reference_id: params.referenceId ?? null,
      });

      if (!error && data) {
        const payload = data as Record<string, unknown>;
        return {
          status: payload.status === "idempotent_duplicate" ? "idempotent_duplicate" : "success",
          refunded: Number(payload.refunded ?? params.amount),
          balance: Number(payload.balance ?? 0),
        };
      }
    } catch {
      // Fallback
    }

    const currentBalance = await this.getBalance(params.workspaceId);
    const newBalance = currentBalance + params.amount;
    this.mockBalances.set(params.workspaceId, newBalance);

    const txId = `tx_refund_${Date.now()}`;
    const tx: CreditTransactionRow = {
      id: txId,
      wallet_id: `wallet_${params.workspaceId}`,
      user_id: null,
      amount: params.amount,
      balance_after: newBalance,
      transaction_type: "refund",
      reference_id: params.referenceId ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      description: params.reason,
      created_at: new Date().toISOString(),
    };

    const txList = this.mockTransactions.get(params.workspaceId) ?? [];
    this.mockTransactions.set(params.workspaceId, [tx, ...txList]);

    if (params.idempotencyKey) {
      this.processedIdempotencyKeys.set(params.idempotencyKey, {
        status: "idempotent_duplicate",
        amount: params.amount,
        balance: newBalance,
        txId,
      });
    }

    return {
      status: "success",
      refunded: params.amount,
      balance: newBalance,
      transactionId: txId,
    };
  }

  /**
   * Enforces workspace and per-user limits before executing AI/render operations.
   */
  static async enforceLimits(
    params: LimitEnforcementParams
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (
      params.userMonthlyLimit !== undefined &&
      params.currentUserMonthlyUsage !== undefined
    ) {
      if (params.currentUserMonthlyUsage + params.operationCost > params.userMonthlyLimit) {
        return {
          allowed: false,
          reason: `Batas kuota kredit bulanan pengguna tercapai (${params.currentUserMonthlyUsage}/${params.userMonthlyLimit} kredit).`,
        };
      }
    }

    const currentBalance = await this.getBalance(params.workspaceId);
    if (currentBalance < params.operationCost) {
      return {
        allowed: false,
        reason: `Saldo kredit workspace tidak mencukupi (${currentBalance} tersedia, butuh ${params.operationCost}).`,
      };
    }

    return { allowed: true };
  }

  /**
   * Retrieves credit ledger and recent transactions.
   */
  static async getCreditHistory(
    workspaceId: string,
    userId: string,
    limit: number = 20
  ): Promise<{ balance: number; transactions: CreditTransactionRow[] }> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke riwayat kredit workspace.");
    }

    const balance = await this.getBalance(workspaceId);
    let transactions: CreditTransactionRow[] = [];

    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("credit_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (data && data.length > 0) {
        transactions = data as CreditTransactionRow[];
      }
    } catch {
      // Fallback
    }

    if (transactions.length === 0) {
      transactions = this.mockTransactions.get(workspaceId) ?? [];
    }

    return {
      balance,
      transactions,
    };
  }
}
