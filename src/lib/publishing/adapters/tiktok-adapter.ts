import { BasePublishingAdapter } from "../base-adapter";
import type {
  PlatformCapabilities,
  PublishPayload,
  ValidationResult,
  UploadResult,
  ScheduleResult,
  PublishResult,
  PublishStatusCheckResult,
  ManualExportPackage,
  ConnectedAccountDetails,
  MockPublishOptions,
} from "../types";

export class TikTokAdapter extends BasePublishingAdapter {
  readonly platform = "tiktok" as const;

  getCapabilities(): PlatformCapabilities {
    return {
      platform: "tiktok",
      displayName: "TikTok",
      canUpload: true,
      canSchedule: true,
      canPublishDirectly: true,
      requiresManualFallback: false,
      supportsReelsShorts: true,
      maxVideoDurationSec: 600,
      maxCaptionLength: 2200,
      supportedMediaTypes: ["video"],
      apiDocUrl: "https://open.tiktokapis.com/v2/post/publish/creator_info/query/",
      rateLimitPerDay: 50,
    };
  }

  validateContent(payload: PublishPayload): ValidationResult {
    const errors: string[] = [];
    if (!payload.mediaUrl) {
      errors.push("URL media video wajib disertakan untuk TikTok.");
    }
    if (payload.caption && payload.caption.length > 2200) {
      errors.push(
        `Panjang caption (${payload.caption.length} karakter) melebihi batas maksimum TikTok 2200 karakter.`
      );
    }
    if (payload.durationSeconds && payload.durationSeconds > 600) {
      errors.push("Durasi video melebihi batas maksimum TikTok 10 menit (600 detik).");
    }
    return { valid: errors.length === 0, errors };
  }

  async connectAccount(
    authCode: string,
    redirectUri: string
  ): Promise<ConnectedAccountDetails> {
    if (!authCode) {
      throw new Error("Authorization code dari TikTok OAuth wajib diisi.");
    }
    return {
      accountId: `tiktok_${Date.now()}`,
      accountName: "Creator TikTok Account",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
      accessToken: `tt_act_${Buffer.from(authCode).toString("base64")}`,
      refreshToken: `tt_rft_${Date.now()}`,
      expiresIn: 86400,
    };
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    if (!accountId) return false;
    return true;
  }

  async uploadMedia(
    payload: PublishPayload,
    accessToken?: string
  ): Promise<UploadResult> {
    const validation = this.validateContent(payload);
    if (!validation.valid) {
      return {
        uploadId: "",
        status: "failed",
        error: validation.errors.join("; "),
      };
    }
    return {
      uploadId: `tt_upload_${Date.now()}`,
      status: "uploaded",
      externalUri: payload.mediaUrl,
    };
  }

  async schedulePost(
    uploadId: string,
    scheduledFor: Date,
    payload: PublishPayload,
    accessToken?: string
  ): Promise<ScheduleResult> {
    if (!uploadId) {
      return { scheduleId: "", scheduledFor: "", status: "failed", error: "Upload ID tidak valid" };
    }
    return {
      scheduleId: `tt_sched_${uploadId}`,
      scheduledFor: scheduledFor.toISOString(),
      status: "scheduled",
    };
  }

  async publishPost(
    uploadId: string,
    payload: PublishPayload,
    accessToken?: string
  ): Promise<PublishResult> {
    if (!uploadId) {
      return {
        jobId: "",
        externalPostId: "",
        status: "failed",
        isConfirmed: false,
        errorMessage: "Upload ID tidak valid untuk publish ke TikTok",
      };
    }
    const publishId = `tt_pub_${Date.now()}`;
    return {
      jobId: publishId,
      externalPostId: publishId,
      status: "publishing",
      isConfirmed: false,
    };
  }

  async checkPublishStatus(
    externalPostId: string,
    options?: MockPublishOptions,
    accessToken?: string
  ): Promise<PublishStatusCheckResult> {
    if (options?.mockRemoteState === "PUBLISH_COMPLETE") {
      return {
        status: "published",
        isConfirmed: true,
        externalPostUrl:
          options.mockPostUrl || `https://www.tiktok.com/@creator/video/${externalPostId}`,
      };
    }
    if (options?.mockRemoteState === "FAILED") {
      return {
        status: "failed",
        isConfirmed: false,
        errorMessage: options.mockErrorMessage || "Gagal dipublikasikan oleh sistem TikTok",
      };
    }
    return {
      status: "processing",
      isConfirmed: false,
    };
  }

  generateManualExportFallback(payload: PublishPayload): ManualExportPackage {
    return {
      platform: "tiktok",
      title: payload.title,
      caption: payload.caption,
      downloadUrl: payload.mediaUrl,
      coverUrl: payload.coverUrl,
      recommendedHashtags: payload.hashtags ?? ["fyp", "trending", "creator"],
      instructions: [
        "Unduh video 9:16 beresolusi 1080p melalui tombol di bawah.",
        "Buka aplikasi TikTok di smartphone Anda dan tekan ikon (+).",
        "Pilih file video yang telah diunduh dari galeri Anda.",
        "Salin teks caption dan tagar yang telah dioptimalkan ke kolom deskripsi.",
        "Pilih cover frame video yang menarik.",
        "Tekan Posting dan simpan tautan video setelah berhasil diterbitkan.",
      ],
      checklist: [
        "Download file video MP4",
        "Salin teks caption & hashtags",
        "Buka aplikasi TikTok & pilih video",
        "Periksa audio & sinkronisasi subtitle",
        "Posting dan masukkan link publikasi",
      ],
    };
  }
}
