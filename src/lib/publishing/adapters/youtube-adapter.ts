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

export class YouTubeAdapter extends BasePublishingAdapter {
  readonly platform = "youtube" as const;

  getCapabilities(): PlatformCapabilities {
    return {
      platform: "youtube",
      displayName: "YouTube",
      canUpload: true,
      canSchedule: true,
      canPublishDirectly: true,
      requiresManualFallback: false,
      supportsReelsShorts: true,
      maxVideoDurationSec: 43200, // 12 hours
      maxCaptionLength: 5000,
      supportedMediaTypes: ["video"],
      apiDocUrl: "https://developers.google.com/youtube/v3/docs/videos/insert",
      rateLimitPerDay: 100,
    };
  }

  validateContent(payload: PublishPayload): ValidationResult {
    const errors: string[] = [];
    if (!payload.title) {
      errors.push("Judul video YouTube wajib diisi.");
    }
    if (payload.title && payload.title.length > 100) {
      errors.push("Judul video YouTube tidak boleh melebihi 100 karakter.");
    }
    if (!payload.mediaUrl) {
      errors.push("URL media video wajib disertakan untuk YouTube.");
    }
    if (payload.caption && payload.caption.length > 5000) {
      errors.push("Deskripsi video YouTube tidak boleh melebihi 5000 karakter.");
    }
    return { valid: errors.length === 0, errors };
  }

  async connectAccount(
    authCode: string,
    redirectUri: string
  ): Promise<ConnectedAccountDetails> {
    if (!authCode) {
      throw new Error("Authorization code dari Google OAuth 2.0 wajib diisi.");
    }
    return {
      accountId: `yt_${Date.now()}`,
      accountName: "Creator YouTube Channel",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
      accessToken: `ya29.${Buffer.from(authCode).toString("base64")}`,
      refreshToken: `1//04yt_${Date.now()}`,
      expiresIn: 3600,
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
      uploadId: `yt_resumable_${Date.now()}`,
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
      return { scheduleId: "", scheduledFor: "", status: "failed", error: "Upload ID YouTube tidak valid" };
    }
    return {
      scheduleId: `yt_sched_${uploadId}`,
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
        errorMessage: "Upload ID YouTube tidak valid",
      };
    }
    const videoId = `yt_vid_${Date.now()}`;
    return {
      jobId: videoId,
      externalPostId: videoId,
      status: "publishing",
      isConfirmed: false,
    };
  }

  async checkPublishStatus(
    externalPostId: string,
    options?: MockPublishOptions,
    accessToken?: string
  ): Promise<PublishStatusCheckResult> {
    if (options?.mockRemoteState === "PROCESSED" || options?.mockRemoteState === "PUBLISH_COMPLETE") {
      return {
        status: "published",
        isConfirmed: true,
        externalPostUrl:
          options.mockPostUrl || `https://www.youtube.com/watch?v=${externalPostId}`,
      };
    }
    if (options?.mockRemoteState === "FAILED" || options?.mockRemoteState === "REJECTED") {
      return {
        status: "failed",
        isConfirmed: false,
        errorMessage: options.mockErrorMessage || "Pemrosesan video YouTube gagal",
      };
    }
    return {
      status: "processing",
      isConfirmed: false,
    };
  }

  generateManualExportFallback(payload: PublishPayload): ManualExportPackage {
    return {
      platform: "youtube",
      title: payload.title,
      caption: payload.caption,
      downloadUrl: payload.mediaUrl,
      coverUrl: payload.coverUrl,
      recommendedHashtags: payload.hashtags ?? ["shorts", "creator", "tutorial"],
      instructions: [
        "Unduh video format MP4 beresolusi 1080p.",
        "Buka YouTube Studio di browser (studio.youtube.com) atau aplikasi YouTube.",
        "Pilih 'Create' lalu 'Upload videos'.",
        "Unggah file video dan lengkapi formulir Judul serta Deskripsi.",
        "Tambahkan tag #Shorts di judul jika berdurasi <= 60 detik.",
        "Atur visibilitas menjadi Publik atau Jadwalkan waktu penayangan.",
      ],
      checklist: [
        "Download file video",
        "Buka YouTube Studio",
        "Unggah file & lengkapi metadata",
        "Periksa setelan visibilitas & penonton",
        "Publikasikan dan salin URL video",
      ],
    };
  }
}
