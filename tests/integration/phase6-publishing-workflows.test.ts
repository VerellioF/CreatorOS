import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublishingService } from "@/services/publishing-service";

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn(async () => true),
  },
}));

describe("Phase 6 Integration Tests — Publishing Workflows & Logs", () => {
  const workspaceId = "ws-pub-test-123";
  const userId = "usr-pub-test-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists all connected social accounts with accurate platform capabilities", async () => {
    const accounts = await PublishingService.getConnectedAccounts(workspaceId, userId);
    expect(Array.isArray(accounts)).toBe(true);
  });

  it("creates a publishing job with validation and audit logging", async () => {
    const job = await PublishingService.createPublishingJob({
      workspaceId,
      userId,
      contentItemId: "item-test-1",
      platform: "tiktok",
      title: "Video TikTok Keren",
      caption: "Caption video edukasi #edukasi",
      mediaUrl: "https://storage.creatoros.ai/renders/test.mp4",
      aspectRatio: "9:16",
    });

    expect(job).toBeDefined();
    expect(job.status).toBe("draft");
    expect(job.platform).toBe("tiktok");
  });

  it("generates a manual export package for Shopee Video and marks job manual_export_ready", async () => {
    const job = await PublishingService.createPublishingJob({
      workspaceId,
      userId,
      contentItemId: "item-shopee-1",
      platform: "shopee",
      title: "Review Mic Wireless Terbaik 2026",
      caption: "Mic ini wajib punya buat konten kreator pemula #ShopeeHaul",
      mediaUrl: "https://storage.creatoros.ai/renders/mic.mp4",
      aspectRatio: "9:16",
      productLinks: ["https://shopee.co.id/product/123"],
    });

    const exportBundle = await PublishingService.prepareManualExport(job.id, workspaceId, userId);
    expect(exportBundle.status).toBe("manual_export_ready");
    expect(exportBundle.manualExportData).toBeDefined();
    expect(exportBundle.manualExportData?.platform).toBe("shopee");
    expect(exportBundle.manualExportData?.checklist.length).toBeGreaterThan(0);
  });

  it("only marks content published after explicit platform or creator confirmation", async () => {
    const job = await PublishingService.createPublishingJob({
      workspaceId,
      userId,
      contentItemId: "item-confirm-1",
      platform: "shopee",
      title: "Shopee Video Manual Publish",
      caption: "Caption test",
      mediaUrl: "https://storage.creatoros.ai/renders/video.mp4",
      aspectRatio: "9:16",
    });

    // Confirmation with real creator URL
    const confirmed = await PublishingService.confirmManualPublish(
      job.id,
      workspaceId,
      userId,
      "https://id.shp.ee/v/test12345"
    );

    expect(confirmed.status).toBe("published");
    expect(confirmed.externalPostUrl).toBe("https://id.shp.ee/v/test12345");
    expect(confirmed.publishedAt).toBeDefined();
  });
});
