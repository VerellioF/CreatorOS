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

export class InstagramAdapter extends BasePublishingAdapter {
  readonly platform = "instagram" as const;

  getCapabilities(): PlatformCapabilities {
    return {
      platform: "instagram",
      displayName: "Instagram",
      canUpload: true,
      canSchedule: true,
      canPublishDirectly: true,
      requiresManualFallback: false,
      supportsReelsShorts: true,
      maxVideoDurationSec: 900,
      maxCaptionLength: 2200,
      supportedMediaTypes: ["video", "image", "carousel"],
      apiDocUrl: "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing",
      rateLimitPerDay: 50,
    };
  }

  validateContent(payload: PublishPayload): ValidationResult {
    const errors: string[] = [];
    if (!payload.mediaUrl) {
      errors.push("URL media wajib disertakan untuk Instagram.");
    }
    if (payload.caption && payload.caption.length > 2200) {
      errors.push(
        `Panjang caption (${payload.caption.length} karakter) melebihi batas maksimum Instagram 2200 karakter.`
      );
    }
    if (payload.durationSeconds && payload.durationSeconds > 900) {
      errors.push("Durasi video melebihi batas maksimum Instagram Reels 15 menit (900 detik).");
    }
    return { valid: errors.length === 0, errors };
  }

  async connectAccount(
    authCode: string,
    redirectUri: string
  ): Promise<ConnectedAccountDetails> {
    if (!authCode) {
      throw new Error("Authorization code dari Instagram / Facebook Login OAuth wajib diisi.");
    }
    return {
      accountId: `ig_${Date.now()}`,
      accountName: "Creator Instagram Professional",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
      accessToken: `ig_token_${Buffer.from(authCode).toString("base64")}`,
      refreshToken: `ig_refresh_${Date.now()}`,
      expiresIn: 5184000, // 60 days
    };
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    return Boolean(accountId);
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
      uploadId: `ig_container_${Date.now()}`,
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
      return { scheduleId: "", scheduledFor: "", status: "failed", error: "Container ID tidak valid" };
    }
    return {
      scheduleId: `ig_sched_${uploadId}`,
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
        errorMessage: "Container ID Instagram tidak valid",
      };
    }
    const containerId = `ig_reels_${Date.now()}`;
    return {
      jobId: containerId,
      externalPostId: containerId,
      status: "publishing",
      isConfirmed: false,
    };
  }

  async checkPublishStatus(
    externalPostId: string,
    options?: MockPublishOptions,
    accessToken?: string
  ): Promise<PublishStatusCheckResult> {
    if (options?.mockRemoteState === "FINISHED") {
      return {
        status: "published",
        isConfirmed: true,
        externalPostUrl:
          options.mockPostUrl || `https://www.instagram.com/reel/${externalPostId}/`,
      };
    }
    if (options?.mockRemoteState === "ERROR") {
      return {
        status: "failed",
        isConfirmed: false,
        errorMessage: options.mockErrorMessage || "Gagal memproses container media di Instagram",
      };
    }
    return {
      status: "processing",
      isConfirmed: false,
    };
  }

  generateManualExportFallback(payload: PublishPayload): ManualExportPackage {
    return {
      platform: "instagram",
      title: payload.title,
      caption: payload.caption,
      downloadUrl: payload.mediaUrl,
      coverUrl: payload.coverUrl,
      recommendedHashtags: payload.hashtags ?? ["reels", "creator", "indonesia"],
      instructions: [
        "Unduh file video MP4 berkualitas tinggi.",
        "Buka aplikasi Instagram, geser ke kanan untuk membuat Reel baru.",
        "Pilih file video dari galeri perangkat Anda.",
        "Salin caption yang telah disiapkan beserta tagar strategis.",
        "Atur gambar sampul (cover frame) yang menarik.",
        "Tekan Bagikan / Share untuk menerbitkan ke profil dan feed Reels.",
      ],
      checklist: [
        "Download media MP4",
        "Salin caption & hashtag",
        "Unggah ke Instagram Reels",
        "Pilih Cover Reel",
        "Bagikan ke Feed & Profil",
      ],
    };
  }
}
