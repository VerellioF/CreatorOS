import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "./workspace-service";
import { CreditService } from "./credit-service";
import { MidtransClient } from "@/lib/billing/midtrans-client";
import type {
  SaasPlanRow,
  SubscriptionRow,
  PaymentTransactionRow,
  PlanTier,
  PaymentStatus,
  Json,
} from "@/lib/supabase/types";

export interface CreateCheckoutParams {
  workspaceId: string;
  userId: string;
  planTier: PlanTier;
  userEmail?: string;
  userName?: string;
  customOrderId?: string;
}

export interface CheckoutResult {
  orderId: string;
  planTier: PlanTier;
  grossAmount: number;
  snapToken: string;
  redirectUrl: string;
}

export interface MidtransWebhookPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  payment_type?: string;
  fraud_status?: string;
  serverKeyOverride?: string;
  [key: string]: unknown;
}

export class BillingService {
  // Configurable default SaaS plans (matching seed in migration)
  private static defaultPlans: SaasPlanRow[] = [
    {
      id: "free",
      name: "Free Starter",
      price_idr: 0,
      monthly_credits: 50,
      max_workspaces: 1,
      max_members_per_workspace: 1,
      max_storage_mb: 500,
      features: ["basic_ai", "single_channel_publish", "manual_export"],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "creator",
      name: "Creator Pro",
      price_idr: 149000,
      monthly_credits: 500,
      max_workspaces: 3,
      max_members_per_workspace: 3,
      max_storage_mb: 5000,
      features: ["advanced_ai", "all_channels_publish", "batch_scheduler", "voice_synthesis"],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "pro",
      name: "Professional Studio",
      price_idr: 349000,
      monthly_credits: 2000,
      max_workspaces: 10,
      max_members_per_workspace: 10,
      max_storage_mb: 25000,
      features: ["unlimited_agents", "team_collaboration", "priority_render", "custom_dna"],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "business",
      name: "Enterprise / Agency",
      price_idr: 899000,
      monthly_credits: 6000,
      max_workspaces: 50,
      max_members_per_workspace: 50,
      max_storage_mb: 100000,
      features: ["white_label_export", "dedicated_queue", "sla_support", "custom_integrations"],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // In-memory fallback stores for test/offline environments
  private static mockSubscriptions: Map<string, SubscriptionRow> = new Map();
  private static mockPayments: Map<string, PaymentTransactionRow> = new Map();

  static resetMockData(): void {
    this.mockSubscriptions.clear();
    this.mockPayments.clear();
  }

  /**
   * Retrieves all available SaaS plans.
   */
  static async getAvailablePlans(): Promise<SaasPlanRow[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("saas_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_idr", { ascending: true });

      if (!error && data && data.length > 0) {
        return data as SaasPlanRow[];
      }
    } catch {
      // Fallback
    }

    return this.defaultPlans;
  }

  /**
   * Creates a Midtrans Snap checkout session for subscribing to a paid tier.
   */
  static async createSubscriptionCheckout(
    params: CreateCheckoutParams
  ): Promise<CheckoutResult> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      params.userId,
      params.workspaceId,
      "admin"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak: Hanya Admin/Owner yang dapat mengelola pembayaran.");
    }

    const plans = await this.getAvailablePlans();
    const plan = plans.find((p) => p.id === params.planTier);
    if (!plan) {
      throw new Error(`Paket langganan '${params.planTier}' tidak ditemukan.`);
    }

    if (plan.price_idr === 0) {
      throw new Error("Paket Gratis tidak memerlukan pembayaran checkout Midtrans.");
    }

    const orderId =
      params.customOrderId ||
      `ORD_CREATOROS_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const snap = await MidtransClient.createSnapTransaction({
      orderId,
      grossAmount: plan.price_idr,
      customerDetails: {
        first_name: params.userName || "Creator User",
        email: params.userEmail || "creator@creatoros.ai",
      },
      itemDetails: [
        {
          id: plan.id,
          price: plan.price_idr,
          quantity: 1,
          name: `Langganan ${plan.name} (1 Bulan)`,
        },
      ],
    });

    const paymentRow: PaymentTransactionRow = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspace_id: params.workspaceId,
      user_id: params.userId,
      order_id: orderId,
      plan_tier: params.planTier,
      gross_amount: plan.price_idr,
      payment_type: null,
      transaction_status: "pending",
      fraud_status: null,
      snap_token: snap.token,
      snap_redirect_url: snap.redirect_url,
      midtrans_response: null,
      settled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = await createClient();
      await supabase.from("payment_transactions").insert(paymentRow);
    } catch {
      // Fallback
    }

    this.mockPayments.set(orderId, paymentRow);

    return {
      orderId,
      planTier: params.planTier,
      grossAmount: plan.price_idr,
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
    };
  }

  /**
   * Processes verified Midtrans Webhook notifications.
   * STRICT SECURITY: Verifies cryptographic SHA-512 signature before mutating state.
   */
  static async handleMidtransWebhook(
    payload: MidtransWebhookPayload,
    internalOptions?: { serverKeyOverride?: string }
  ): Promise<{ success: boolean; action: string }> {
    // Only permit serverKeyOverride if passed through internalOptions or in test environment (never from external payload)
    const serverKey = internalOptions?.serverKeyOverride || (process.env.NODE_ENV === "test" ? (payload.serverKeyOverride as string | undefined) : undefined);
    const isValid = MidtransClient.verifySignature({
      orderId: payload.order_id,
      statusCode: payload.status_code,
      grossAmount: payload.gross_amount,
      signatureKey: payload.signature_key,
      serverKey,
    });

    if (!isValid) {
      throw new Error("Invalid Midtrans Webhook Signature: Verifikasi SHA-512 gagal.");
    }

    const midtransStatus = payload.transaction_status;
    const fraudStatus = payload.fraud_status;

    // Check if payment already exists
    let payment = this.mockPayments.get(payload.order_id);
    if (!payment) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from("payment_transactions")
          .select("*")
          .eq("order_id", payload.order_id)
          .single();
        if (data) payment = data as PaymentTransactionRow;
      } catch {
        // Fallback
      }
    }

    if (!payment) {
      throw new Error(`Data transaksi tidak ditemukan untuk Order ID: ${payload.order_id}`);
    }

    // Try executing atomic database stored procedure
    try {
      const supabase = await createClient();
      await supabase.rpc("activate_subscription_payment", {
        p_order_id: payload.order_id,
        p_midtrans_status: midtransStatus,
        p_payment_type: payload.payment_type ?? null,
        p_raw_payload: payload as unknown as Json,
      });
    } catch {
      // Fallback to local memory state
    }

    // Handle settlement or capture
    if (
      midtransStatus === "settlement" ||
      (midtransStatus === "capture" && fraudStatus === "accept")
    ) {
      payment.transaction_status = "settlement";
      payment.payment_type = payload.payment_type ?? "qris";
      payment.settled_at = new Date().toISOString();
      payment.midtrans_response = payload as unknown as Json;
      this.mockPayments.set(payload.order_id, payment);

      const periodStart = new Date().toISOString();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const subRow: SubscriptionRow = {
        id: `sub_${Date.now()}`,
        workspace_id: payment.workspace_id,
        plan_tier: payment.plan_tier,
        status: "active",
        billing_cycle: "monthly",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        created_at: periodStart,
        updated_at: periodStart,
      };

      this.mockSubscriptions.set(payment.workspace_id, subRow);

      // Allocate monthly plan credits
      const plan = this.defaultPlans.find((p) => p.id === payment!.plan_tier);
      if (plan && plan.monthly_credits > 0) {
        await CreditService.allocateCredits({
          workspaceId: payment.workspace_id,
          amount: plan.monthly_credits,
          type: "monthly_grant",
          idempotencyKey: `sub_grant_${payload.order_id}`,
          description: `Alokasi kredit bulanan: ${plan.name}`,
        });
      }

      return { success: true, action: "activated" };
    }

    if (midtransStatus === "expire" || midtransStatus === "cancel") {
      payment.transaction_status = midtransStatus as PaymentStatus;
      payment.midtrans_response = payload as unknown as Json;
      this.mockPayments.set(payload.order_id, payment);
      return { success: true, action: "expired" };
    }

    payment.transaction_status = midtransStatus as PaymentStatus;
    this.mockPayments.set(payload.order_id, payment);
    return { success: true, action: "updated" };
  }

  /**
   * Anti-fraud guard: Blocks activation attempts originating purely from client redirects.
   */
  static async activateSubscriptionDirectlyUnsafe(params: {
    workspaceId: string;
    planTier: PlanTier;
  }): Promise<never> {
    throw new Error(
      "Aktivasi langganan dari frontend dilarang. Aktivasi hanya dapat dilakukan melalui verifikasi webhook resmi Midtrans atau verifikasi server-to-server."
    );
  }

  /**
   * Retrieves active workspace subscription.
   */
  static async getWorkspaceSubscription(
    workspaceId: string,
    userId: string
  ): Promise<{
    planTier: PlanTier;
    status: string;
    currentPeriodEnd: string;
    isPro: boolean;
  }> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke data langganan workspace.");
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (!error && data) {
        const row = data as SubscriptionRow;
        return {
          planTier: row.plan_tier,
          status: row.status,
          currentPeriodEnd: row.current_period_end,
          isPro: row.plan_tier !== "free",
        };
      }
    } catch {
      // Fallback
    }

    const local = this.mockSubscriptions.get(workspaceId);
    if (local) {
      return {
        planTier: local.plan_tier,
        status: local.status,
        currentPeriodEnd: local.current_period_end,
        isPro: local.plan_tier !== "free",
      };
    }

    // Default to Free tier
    return {
      planTier: "free",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      isPro: false,
    };
  }

  /**
   * Retrieves payment transaction history for workspace.
   */
  static async getPaymentHistory(
    workspaceId: string,
    userId: string
  ): Promise<PaymentTransactionRow[]> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke riwayat pembayaran.");
    }

    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        return data as PaymentTransactionRow[];
      }
    } catch {
      // Fallback
    }

    return Array.from(this.mockPayments.values()).filter(
      (p) => p.workspace_id === workspaceId
    );
  }
}
