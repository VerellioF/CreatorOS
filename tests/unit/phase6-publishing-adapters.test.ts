import { describe, it, expect } from "vitest";
import { PublishingRegistry } from "@/lib/publishing/adapter-registry";
import { TikTokAdapter } from "@/lib/publishing/adapters/tiktok-adapter";
import { InstagramAdapter } from "@/lib/publishing/adapters/instagram-adapter";
import { YouTubeAdapter } from "@/lib/publishing/adapters/youtube-adapter";
import { FacebookAdapter } from "@/lib/publishing/adapters/facebook-adapter";
import { ShopeeVideoAdapter } from "@/lib/publishing/adapters/shopee-adapter";
import type { PublishPayload } from "@/lib/publishing/types";

describe("Phase 6 Platform Publishing Adapters & Capabilities", () => {
  const samplePayload: PublishPayload = {
    title: "Tips Produktivitas Creator 2026",
    caption: "Berikut 3 tips penting untuk mengembangkan channel kamu #produktivitas #creator #tips",
    mediaUrl: "https://storage.creatoros.ai/renders/video-123.mp4",
    mediaType: "video",
    aspectRatio: "9:16",
    durationSeconds: 45,
    hashtags: ["produktivitas", "creator", "tips"],
  };

  it("registers all 5 official platform adapters in PublishingRegistry", () => {
    const platforms = PublishingRegistry.getSupportedPlatforms();
    expect(platforms).toEqual(["tiktok", "instagram", "youtube", "facebook", "shopee"]);
    expect(PublishingRegistry.getAdapter("tiktok")).toBeInstanceOf(TikTokAdapter);
    expect(PublishingRegistry.getAdapter("instagram")).toBeInstanceOf(InstagramAdapter);
    expect(PublishingRegistry.getAdapter("youtube")).toBeInstanceOf(YouTubeAdapter);
    expect(PublishingRegistry.getAdapter("facebook")).toBeInstanceOf(FacebookAdapter);
    expect(PublishingRegistry.getAdapter("shopee")).toBeInstanceOf(ShopeeVideoAdapter);
  });

  describe("Capability Declarations", () => {
    it("declares actual capabilities for TikTok (Official Content Posting API)", () => {
      const adapter = new TikTokAdapter();
      const caps = adapter.getCapabilities();
      expect(caps.canUpload).toBe(true);
      expect(caps.canSchedule).toBe(true);
      expect(caps.canPublishDirectly).toBe(true);
      expect(caps.requiresManualFallback).toBe(false);
      expect(caps.supportsReelsShorts).toBe(true);
      expect(caps.maxVideoDurationSec).toBe(600);
      expect(caps.apiDocUrl).toContain("open.tiktokapis.com");
    });

    it("declares actual capabilities for Instagram (Meta Graph API)", () => {
      const adapter = new InstagramAdapter();
      const caps = adapter.getCapabilities();
      expect(caps.canUpload).toBe(true);
      expect(caps.canSchedule).toBe(true);
      expect(caps.canPublishDirectly).toBe(true);
      expect(caps.requiresManualFallback).toBe(false);
      expect(caps.supportsReelsShorts).toBe(true);
      expect(caps.maxVideoDurationSec).toBe(900);
      expect(caps.apiDocUrl).toContain("developers.facebook.com");
    });

    it("declares actual capabilities for YouTube (YouTube Data API v3)", () => {
      const adapter = new YouTubeAdapter();
      const caps = adapter.getCapabilities();
      expect(caps.canUpload).toBe(true);
      expect(caps.canSchedule).toBe(true);
      expect(caps.canPublishDirectly).toBe(true);
      expect(caps.requiresManualFallback).toBe(false);
      expect(caps.supportsReelsShorts).toBe(true);
      expect(caps.apiDocUrl).toContain("developers.google.com/youtube");
    });

    it("declares actual capabilities for Facebook (Meta Graph API)", () => {
      const adapter = new FacebookAdapter();
      const caps = adapter.getCapabilities();
      expect(caps.canUpload).toBe(true);
      expect(caps.canSchedule).toBe(true);
      expect(caps.canPublishDirectly).toBe(true);
      expect(caps.requiresManualFallback).toBe(false);
      expect(caps.supportsReelsShorts).toBe(true);
      expect(caps.apiDocUrl).toContain("developers.facebook.com");
    });

    it("declares actual capabilities for Shopee Video (Manual Export Fallback)", () => {
      const adapter = new ShopeeVideoAdapter();
      const caps = adapter.getCapabilities();
      // Transparently declares no direct publishing API, zero fake APIs!
      expect(caps.canUpload).toBe(false);
      expect(caps.canSchedule).toBe(false);
      expect(caps.canPublishDirectly).toBe(false);
      expect(caps.requiresManualFallback).toBe(true);
      expect(caps.supportsReelsShorts).toBe(true);
      expect(caps.maxVideoDurationSec).toBe(60);
    });
  });

  describe("Validation & Content Checks", () => {
    it("validates content payload length and constraints per platform", () => {
      const tiktok = new TikTokAdapter();
      const validCheck = tiktok.validateContent(samplePayload);
      expect(validCheck.valid).toBe(true);

      const invalidPayload = {
        ...samplePayload,
        caption: "a".repeat(4000), // TikTok caption limit is 2200 chars
      };
      const invalidCheck = tiktok.validateContent(invalidPayload);
      expect(invalidCheck.valid).toBe(false);
      expect(invalidCheck.errors[0]).toContain("karakter");
    });

    it("requires 9:16 aspect ratio or duration <= 60s for YouTube Shorts formatting", () => {
      const youtube = new YouTubeAdapter();
      const shortsCheck = youtube.validateContent({
        ...samplePayload,
        durationSeconds: 45,
        aspectRatio: "9:16",
      });
      expect(shortsCheck.valid).toBe(true);
    });
  });

  describe("Publishing Lifecycle & Status Confirmation", () => {
    it("does not mark content as published until platform confirms it", async () => {
      const tiktok = new TikTokAdapter();
      // Status check when video is still transcoding/processing
      const pendingStatus = await tiktok.checkPublishStatus("mock_pending_id", {
        mockRemoteState: "PROCESSING_DOWNLOAD",
      });
      expect(pendingStatus.status).toBe("processing");
      expect(pendingStatus.isConfirmed).toBe(false);

      // Status check once platform confirms completion
      const confirmedStatus = await tiktok.checkPublishStatus("mock_completed_id", {
        mockRemoteState: "PUBLISH_COMPLETE",
      });
      expect(confirmedStatus.status).toBe("published");
      expect(confirmedStatus.isConfirmed).toBe(true);
      expect(confirmedStatus.externalPostUrl).toBeDefined();
    });

    it("handles platform rejection gracefully with detailed error message", async () => {
      const instagram = new InstagramAdapter();
      const failedStatus = await instagram.checkPublishStatus("mock_failed_container", {
        mockRemoteState: "ERROR",
        mockErrorMessage: "Video resolution unsupported by Instagram Reels API",
      });
      expect(failedStatus.status).toBe("failed");
      expect(failedStatus.isConfirmed).toBe(false);
      expect(failedStatus.errorMessage).toContain("unsupported");
    });
  });

  describe("Manual Export Fallback Workflow", () => {
    it("generates rich step-by-step export bundle for Shopee Video", () => {
      const shopee = new ShopeeVideoAdapter();
      const exportPackage = shopee.generateManualExportFallback(samplePayload);

      expect(exportPackage.platform).toBe("shopee");
      expect(exportPackage.title).toBe(samplePayload.title);
      expect(exportPackage.caption).toBe(samplePayload.caption);
      expect(exportPackage.downloadUrl).toBe(samplePayload.mediaUrl);
      expect(exportPackage.instructions.length).toBeGreaterThanOrEqual(5);
      expect(exportPackage.checklist).toContain("Download video hasil render");
      expect(exportPackage.checklist).toContain("Buka aplikasi Shopee -> menu Shopee Video");
      expect(exportPackage.checklist).toContain("Tempel caption dan rekomendasi hashtag produk");
      expect(exportPackage.checklist).toContain("Masukkan link konfirmasi video setelah terbit");
    });

    it("provides manual export fallback on automated platforms when direct publish fails", () => {
      const youtube = new YouTubeAdapter();
      const fallbackPackage = youtube.generateManualExportFallback(samplePayload);
      expect(fallbackPackage.platform).toBe("youtube");
      expect(fallbackPackage.downloadUrl).toBe(samplePayload.mediaUrl);
      expect(fallbackPackage.instructions).toBeDefined();
    });
  });
});
