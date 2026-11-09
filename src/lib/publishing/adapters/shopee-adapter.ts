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

export class ShopeeVideoAdapter extends BasePublishingAdapter {
  readonly platform = "shopee" as const;

  getCapabilities(): PlatformCapabilities {
    return {
      platform: "shopee",
      displayName: "Shopee Video",
      canUpload: false,
      canSchedule: false,
      canPublishDirectly: false,
      requiresManualFallback: true,
      supportsReelsShorts: true,
      maxVideoDurationSec: 60,
      maxCaptionLength: 1000,
      supportedMediaTypes: ["video"],
      apiDocUrl: "https://creator.shopee.co.id/",
      rateLimitPerDay: 30,
    };
  }

  validateContent(payload: PublishPayload): ValidationResult {
    const errors: string[] = [];
    if (!payload.mediaUrl) {
      errors.push("URL media video wajib disertakan untuk Shopee Video.");
    }
    if (payload.durationSeconds && payload.durationSeconds > 60) {
      errors.push(
        "Shopee Video merekomendasikan durasi video maksimal 60 detik untuk performa algoritma optimal."
      );
    }
    if (payload.caption && payload.caption.length > 1000) {
      errors.push("Panjang deskripsi melebihi batas 1000 karakter Shopee Video.");
    }
    return { valid: errors.length === 0, errors };
  }

  async connectAccount(
    authCode: string,
    redirectUri: string
  ): Promise<ConnectedAccountDetails> {
    return {
      accountId: `shopee_creator_${Date.now()}`,
      accountName: "Shopee Video Creator Profile",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
      accessToken: `shopee_manual_token_${Date.now()}`,
      expiresIn: 31536000,
    };
  }

  async disconnectAccount(accountId: string): Promise<boolean> {
    return Boolean(accountId);
  }

  async uploadMedia(
    payload: PublishPayload,
    accessToken?: string
  ): Promise<UploadResult> {
    // Declares no direct upload API; generates manual export staging
    return {
      uploadId: `shopee_manual_staged_${Date.now()}`,
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
    return {
      scheduleId: `shopee_manual_sched_${uploadId}`,
      scheduledFor: scheduledFor.toISOString(),
      status: "scheduled",
    };
  }

  async publishPost(
    uploadId: string,
    payload: PublishPayload,
    accessToken?: string
  ): Promise<PublishResult> {
    const manualPackageId = `shopee_manual_${Date.now()}`;
    return {
      jobId: manualPackageId,
      externalPostId: manualPackageId,
      status: "publishing",
      isConfirmed: false,
      errorMessage:
        "Shopee Video memerlukan alur ekspor manual. Gunakan paket ekspor untuk mengunggah melalui aplikasi Shopee.",
    };
  }

  async checkPublishStatus(
    externalPostId: string,
    options?: MockPublishOptions,
    accessToken?: string
  ): Promise<PublishStatusCheckResult> {
    if (options?.mockRemoteState === "CONFIRMED_BY_USER" || options?.mockPostUrl) {
      return {
        status: "published",
        isConfirmed: true,
        externalPostUrl:
          options.mockPostUrl || `https://id.shp.ee/v/${externalPostId}`,
      };
    }
    return {
      status: "processing",
      isConfirmed: false,
      errorMessage: "Menunggu konfirmasi link publikasi manual dari kreator",
    };
  }

  generateManualExportFallback(payload: PublishPayload): ManualExportPackage {
    const affiliateTags = payload.productLinks?.length
      ? ["#RacunShopee", "#ShopeeAffiliate", "#ShopeeHaul"]
      : ["#ShopeeVideo", "#RacunShopee"];

    const combinedHashtags = Array.from(
      new Set([...(payload.hashtags ?? []), ...affiliateTags])
    );

    return {
      platform: "shopee",
      title: payload.title,
      caption: payload.caption,
      downloadUrl: payload.mediaUrl,
      coverUrl: payload.coverUrl,
      recommendedHashtags: combinedHashtags,
      instructions: [
        "1. Download video hasil render (rasio 9:16, 1080p) ke ponsel atau perangkat Anda.",
        "2. Buka aplikasi Shopee di ponsel Anda, lalu pilih tab 'Shopee Video' di navigasi bawah.",
        "3. Ketuk tombol kamera / ikon (+) di sudut kanan atas untuk membuat video baru.",
        "4. Pilih video yang telah Anda unduh dari galeri perangkat.",
        "5. Salin teks judul dan caption yang telah disiapkan di CreatorOS AI.",
        "6. Tambahkan tautan keranjang produk / affiliate Shopee sesuai produk yang dibahas.",
        "7. Tekan 'Posting' untuk menayangkan Shopee Video Anda.",
        "8. Salin link video yang telah tayang, lalu tempelkan ke CreatorOS AI untuk memverifikasi publikasi.",
      ],
      checklist: [
        "Download video hasil render",
        "Buka aplikasi Shopee -> menu Shopee Video",
        "Pilih file video MP4 (9:16) dari galeri",
        "Tempel caption dan rekomendasi hashtag produk",
        "Tautkan keranjang oranye / affiliate produk jika relevan",
        "Posting video ke Shopee Video",
        "Masukkan link konfirmasi video setelah terbit",
      ],
    };
  }
}
