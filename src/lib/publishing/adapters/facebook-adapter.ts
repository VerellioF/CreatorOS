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

export class FacebookAdapter extends BasePublishingAdapter {
  readonly platform = "facebook" as const;

  getCapabilities(): PlatformCapabilities {
    return {
      platform: "facebook",
      displayName: "Facebook",
      canUpload: true,
      canSchedule: true,
      canPublishDirectly: true,
      requiresManualFallback: false,
      supportsReelsShorts: true,
      maxVideoDurationSec: 14400, // 4 hours
      maxCaptionLength: 5000,
      supportedMediaTypes: ["video", "image", "carousel"],
      apiDocUrl: "https://developers.facebook.com/docs/video-api",
      rateLimitPerDay: 100,
    };
  }

  validateContent(payload: PublishPayload): ValidationResult {
    const errors: string[] = [];
    if (!payload.mediaUrl) {
      errors.push("URL media video/gambar wajib disertakan untuk Facebook.");
    }
    if (payload.caption && payload.caption.length > 5000) {
      errors.push("Caption Facebook melebihi batas 5000 karakter.");
    }
    return { valid: errors.length === 0, errors };
  }

  async connectAccount(
    authCode: string,
    redirectUri: string
  ): Promise<ConnectedAccountDetails> {
    if (!authCode) {
      throw new Error("Authorization code dari Facebook Login OAuth wajib diisi.");
    }
    return {
      accountId: `fb_page_${Date.now()}`,
      accountName: "Creator Facebook Page",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
      accessToken: `EAA_${Buffer.from(authCode).toString("base64")}`,
      expiresIn: 5184000,
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
      uploadId: `fb_asset_${Date.now()}`,
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
      return { scheduleId: "", scheduledFor: "", status: "failed", error: "Upload ID Facebook tidak valid" };
    }
    return {
      scheduleId: `fb_sched_${uploadId}`,
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
        errorMessage: "Upload ID Facebook tidak valid",
      };
    }
    const postId = `fb_reel_${Date.now()}`;
    return {
      jobId: postId,
      externalPostId: postId,
      status: "publishing",
      isConfirmed: false,
    };
  }

  async checkPublishStatus(
    externalPostId: string,
    options?: MockPublishOptions,
    accessToken?: string
  ): Promise<PublishStatusCheckResult> {
    if (options?.mockRemoteState === "SUCCESS" || options?.mockRemoteState === "PUBLISH_COMPLETE") {
      return {
        status: "published",
        isConfirmed: true,
        externalPostUrl:
          options.mockPostUrl || `https://www.facebook.com/reel/${externalPostId}`,
      };
    }
    if (options?.mockRemoteState === "FAILED") {
      return {
        status: "failed",
        isConfirmed: false,
        errorMessage: options.mockErrorMessage || "Gagal mempublikasikan ke Facebook Page",
      };
    }
    return {
      status: "processing",
      isConfirmed: false,
    };
  }

  generateManualExportFallback(payload: PublishPayload): ManualExportPackage {
    return {
      platform: "facebook",
      title: payload.title,
      caption: payload.caption,
      downloadUrl: payload.mediaUrl,
      coverUrl: payload.coverUrl,
      recommendedHashtags: payload.hashtags ?? ["facebookreels", "video", "creator"],
      instructions: [
        "Unduh video format MP4 beresolusi 1080p.",
        "Buka Meta Business Suite atau aplikasi Facebook Halaman Anda.",
        "Pilih 'Buat Reel' atau 'Posting Video'.",
        "Unggah file video dan masukkan teks caption yang telah disiapkan.",
        "Tambahkan tagar relevan dan pilih cover frame terbaik.",
        "Tekan Terbitkan atau Jadwalkan postingan Anda.",
      ],
      checklist: [
        "Download file video",
        "Buka Meta Business Suite",
        "Buat Facebook Reel baru",
        "Tempel deskripsi & hashtag",
        "Publikasikan dan salin URL tayangan",
      ],
    };
  }
}
