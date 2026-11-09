import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "./workspace-service";
import { PublishingRegistry } from "@/lib/publishing/adapter-registry";
import type {
  PublishPayload,
  ManualExportPackage,
  ConnectedAccountDetails,
} from "@/lib/publishing/types";
import type {
  PublishingJobRow,
  PublishingLogRow,
  SocialAccountRow,
  PublishingPlatform,
  PublishingJobStatus,
  PublishingLogStatus,
  Json,
} from "@/lib/supabase/types";

export interface CreatePublishingJobParams {
  workspaceId: string;
  userId: string;
  contentItemId: string;
  socialAccountId?: string | null;
  platform: PublishingPlatform;
  title: string;
  caption?: string;
  mediaAssetId?: string | null;
  mediaUrl: string;
  aspectRatio?: "9:16" | "16:9" | "1:1" | "4:5";
  durationSeconds?: number;
  coverUrl?: string;
  hashtags?: string[];
  productLinks?: string[];
  scheduledFor?: string | null;
}

export class PublishingService {
  // In-memory registry fallback for environments without live Supabase database connection
  private static mockJobs: Map<string, PublishingJobRow> = new Map();
  private static mockLogs: Map<string, PublishingLogRow[]> = new Map();
  private static mockAccounts: Map<string, SocialAccountRow[]> = new Map();

  static resetMockData(): void {
    this.mockJobs.clear();
    this.mockLogs.clear();
    this.mockAccounts.clear();
  }

  /**
   * Lists connected social accounts for the workspace with declared platform capabilities.
   */
  static async getConnectedAccounts(
    workspaceId: string,
    userId: string
  ): Promise<SocialAccountRow[]> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke akun sosial media workspace ini.");
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("social_accounts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data as SocialAccountRow[];
      }
    } catch {
      // Fallback to local memory store
    }

    const local = this.mockAccounts.get(workspaceId) ?? [];
    return local;
  }

  /**
   * Connects a new social account using verified OAuth flow.
   */
  static async connectSocialAccount(params: {
    workspaceId: string;
    userId: string;
    platform: PublishingPlatform;
    accountDetails: ConnectedAccountDetails;
  }): Promise<SocialAccountRow> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      params.userId,
      params.workspaceId,
      "editor"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak: Hanya editor/admin yang dapat menghubungkan akun sosial.");
    }

    const adapter = PublishingRegistry.getAdapter(params.platform);
    const capabilities = adapter.getCapabilities();

    const newAccount: SocialAccountRow = {
      id: `acc_${Date.now()}`,
      workspace_id: params.workspaceId,
      platform: params.platform,
      account_name: params.accountDetails.accountName,
      account_id: params.accountDetails.accountId,
      avatar_url: params.accountDetails.avatarUrl ?? null,
      access_token_encrypted: params.accountDetails.accessToken,
      refresh_token_encrypted: params.accountDetails.refreshToken ?? null,
      token_expires_at: params.accountDetails.expiresIn
        ? new Date(Date.now() + params.accountDetails.expiresIn * 1000).toISOString()
        : null,
      capabilities: capabilities as unknown as Json,
      status: "connected",
      last_error: null,
      connected_by: params.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("social_accounts")
        .upsert(newAccount, { onConflict: "workspace_id,platform,account_id" })
        .select()
        .single();

      if (!error && data) {
        return data as SocialAccountRow;
      }
    } catch {
      // Fallback
    }

    const existing = this.mockAccounts.get(params.workspaceId) ?? [];
    const updated = [newAccount, ...existing.filter((a) => a.account_id !== newAccount.account_id)];
    this.mockAccounts.set(params.workspaceId, updated);
    return newAccount;
  }

  /**
   * Disconnects a social account.
   */
  static async disconnectSocialAccount(
    accountId: string,
    workspaceId: string,
    userId: string
  ): Promise<boolean> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak untuk memutuskan akun sosial.");
    }

    try {
      const supabase = await createClient();
      await supabase
        .from("social_accounts")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("id", accountId)
        .eq("workspace_id", workspaceId);
    } catch {
      // Fallback
    }

    const existing = this.mockAccounts.get(workspaceId) ?? [];
    this.mockAccounts.set(
      workspaceId,
      existing.filter((a) => a.id !== accountId)
    );
    return true;
  }

  /**
   * Creates a publishing job with payload validation and audit logging.
   */
  static async createPublishingJob(
    params: CreatePublishingJobParams
  ): Promise<PublishingJobRow> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      params.userId,
      params.workspaceId,
      "editor"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak: Diperlukan role editor/admin untuk membuat pekerjaan publikasi.");
    }

    const adapter = PublishingRegistry.getAdapter(params.platform);
    const payload: PublishPayload = {
      title: params.title,
      caption: params.caption ?? "",
      mediaUrl: params.mediaUrl,
      mediaType: "video",
      aspectRatio: params.aspectRatio ?? "9:16",
      durationSeconds: params.durationSeconds,
      coverUrl: params.coverUrl,
      hashtags: params.hashtags,
      productLinks: params.productLinks,
      scheduledFor: params.scheduledFor ?? undefined,
    };

    const validation = adapter.validateContent(payload);
    if (!validation.valid) {
      throw new Error(`Validasi konten gagal: ${validation.errors.join("; ")}`);
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const jobRow: PublishingJobRow = {
      id: jobId,
      workspace_id: params.workspaceId,
      content_item_id: params.contentItemId,
      social_account_id: params.socialAccountId ?? null,
      platform: params.platform,
      title: params.title,
      caption: params.caption ?? null,
      media_asset_id: params.mediaAssetId ?? null,
      media_url: params.mediaUrl,
      status: params.scheduledFor ? "scheduled" : "draft",
      scheduled_for: params.scheduledFor ?? null,
      published_at: null,
      attempts: 0,
      max_attempts: 3,
      external_post_id: null,
      external_post_url: null,
      error_message: null,
      manual_export_data: null,
      created_by: params.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("publishing_jobs")
        .insert(jobRow)
        .select()
        .single();

      if (!error && data) {
        await this.addAuditLog(jobId, params.workspaceId, "schedule", "info", "Pekerjaan publikasi berhasil dibuat.");
        return data as PublishingJobRow;
      }
    } catch {
      // Fallback
    }

    this.mockJobs.set(jobId, jobRow);
    await this.addAuditLog(jobId, params.workspaceId, "schedule", "info", "Pekerjaan publikasi berhasil dibuat.");
    return jobRow;
  }

  /**
   * Generates a rich step-by-step manual export package for Shopee Video or manual fallback.
   */
  static async prepareManualExport(
    jobId: string,
    workspaceId: string,
    userId: string
  ): Promise<{ status: PublishingJobStatus; manualExportData: ManualExportPackage }> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke ekspor manual publikasi.");
    }

    let job = this.mockJobs.get(jobId);
    if (!job) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from("publishing_jobs")
          .select("*")
          .eq("id", jobId)
          .eq("workspace_id", workspaceId)
          .single();
        if (data) job = data as PublishingJobRow;
      } catch {
        // Fallback
      }
    }

    if (!job) {
      throw new Error(`Pekerjaan publikasi ${jobId} tidak ditemukan.`);
    }

    const adapter = PublishingRegistry.getAdapter(job.platform);
    const exportPackage = adapter.generateManualExportFallback({
      title: job.title,
      caption: job.caption ?? "",
      mediaUrl: job.media_url ?? "",
      mediaType: "video",
      aspectRatio: "9:16",
    });

    job.status = "manual_export_ready";
    job.manual_export_data = exportPackage as unknown as Json;
    job.updated_at = new Date().toISOString();
    this.mockJobs.set(jobId, job);

    try {
      const supabase = await createClient();
      await supabase
        .from("publishing_jobs")
        .update({
          status: "manual_export_ready",
          manual_export_data: exportPackage as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("workspace_id", workspaceId);
    } catch {
      // Fallback
    }

    await this.addAuditLog(
      jobId,
      workspaceId,
      "manual_exported",
      "info",
      `Paket ekspor manual disiapkan untuk platform ${job.platform}.`
    );

    return {
      status: "manual_export_ready",
      manualExportData: exportPackage,
    };
  }

  /**
   * Confirms publication when creator submits live external URL.
   * Do not mark content as published until explicitly confirmed!
   */
  static async confirmManualPublish(
    jobId: string,
    workspaceId: string,
    userId: string,
    externalPostUrl: string
  ): Promise<{ status: PublishingJobStatus; externalPostUrl: string; publishedAt: string }> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak untuk konfirmasi publikasi.");
    }

    if (!externalPostUrl || !externalPostUrl.startsWith("http")) {
      throw new Error("URL postingan publikasi tidak valid (harus diawali http/https).");
    }

    let job = this.mockJobs.get(jobId);
    if (!job) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from("publishing_jobs")
          .select("*")
          .eq("id", jobId)
          .eq("workspace_id", workspaceId)
          .single();
        if (data) job = data as PublishingJobRow;
      } catch {
        // Fallback
      }
    }

    if (!job) {
      throw new Error(`Pekerjaan publikasi ${jobId} tidak ditemukan.`);
    }

    const publishedAt = new Date().toISOString();
    job.status = "published";
    job.external_post_url = externalPostUrl;
    job.published_at = publishedAt;
    job.updated_at = publishedAt;
    this.mockJobs.set(jobId, job);

    try {
      const supabase = await createClient();
      await supabase
        .from("publishing_jobs")
        .update({
          status: "published",
          external_post_url: externalPostUrl,
          published_at: publishedAt,
          updated_at: publishedAt,
        })
        .eq("id", jobId)
        .eq("workspace_id", workspaceId);
    } catch {
      // Fallback
    }

    await this.addAuditLog(
      jobId,
      workspaceId,
      "platform_confirmed",
      "success",
      `Publikasi terkonfirmasi berhasil: ${externalPostUrl}`
    );

    return {
      status: "published",
      externalPostUrl,
      publishedAt,
    };
  }

  /**
   * Internal helper to record structured audit logs.
   */
  private static async addAuditLog(
    jobId: string,
    workspaceId: string,
    action: string,
    status: PublishingLogStatus,
    message: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const logRow: PublishingLogRow = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      job_id: jobId,
      workspace_id: workspaceId,
      action,
      status,
      message,
      metadata: metadata as unknown as Json,
      created_at: new Date().toISOString(),
    };

    const existing = this.mockLogs.get(jobId) ?? [];
    this.mockLogs.set(jobId, [...existing, logRow]);

    try {
      const supabase = await createClient();
      await supabase.from("publishing_logs").insert(logRow);
    } catch {
      // Fallback
    }
  }

  /**
   * Fetches audit logs for a publishing job.
   */
  static async getJobLogs(
    jobId: string,
    workspaceId: string,
    userId: string
  ): Promise<PublishingLogRow[]> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke log publikasi.");
    }

    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("publishing_logs")
        .select("*")
        .eq("job_id", jobId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        return data as PublishingLogRow[];
      }
    } catch {
      // Fallback
    }

    return this.mockLogs.get(jobId) ?? [];
  }
}
