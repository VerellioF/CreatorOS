import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "@/services/analytics-service";
import { manualPerformanceEntrySchema } from "@/lib/validation/analytics-schemas";

describe("Phase 7 AnalyticsService & Data Ingestion", () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
  });

  describe("manualPerformanceEntrySchema Validation", () => {
    it("validates a legitimate manual performance entry", () => {
      const validPayload = {
        workspaceId: "11111111-1111-1111-1111-111111111111",
        platform: "tiktok",
        postTitle: "3 Rahasia Konten Edukasi Finansial Meledak",
        postUrl: "https://tiktok.com/@creator/video/123456789",
        views: 45000,
        likes: 3800,
        comments: 240,
        shares: 610,
        saves: 1200,
        clicks: null,
        conversions: null,
      };

      const parsed = manualPerformanceEntrySchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.views).toBe(45000);
        expect(parsed.data.platform).toBe("tiktok");
      }
    });

    it("rejects invalid metrics or empty title", () => {
      const invalidPayload = {
        workspaceId: "invalid-uuid",
        platform: "unsupported_platform",
        postTitle: "",
        views: -50,
        likes: 10,
        comments: 0,
        shares: 0,
        saves: 0,
      };

      const parsed = manualPerformanceEntrySchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe("getWorkspaceAnalyticsOverview Calculation Logic", () => {
    it("computes accurate aggregate metrics and respects zero-fabrication rules", () => {
      const mockItems = [
        {
          id: "snap-1",
          workspace_id: "ws-1",
          content_item_id: null,
          platform: "tiktok" as const,
          post_title: "Video 1 TikTok",
          post_url: "https://tiktok.com/@user/video/1",
          external_post_id: null,
          published_at: new Date().toISOString(),
          snapshot_date: "2026-10-30",
          views: 10000,
          likes: 800,
          comments: 100,
          shares: 50,
          saves: 150,
          clicks: null,
          conversions: null,
          revenue_generated: null,
          watch_time_seconds: 24.5,
          retention_rate_pct: 68.2,
          data_source: "manual_entry" as const,
          is_manual_entry: true,
          account_id: null,
          last_synced_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "snap-2",
          workspace_id: "ws-1",
          content_item_id: null,
          platform: "instagram" as const,
          post_title: "Reels 2 Instagram",
          post_url: "https://instagram.com/reel/2",
          external_post_id: null,
          published_at: new Date().toISOString(),
          snapshot_date: "2026-10-31",
          views: 20000,
          likes: 1500,
          comments: 200,
          shares: 300,
          saves: 400,
          clicks: 120, // Available on Instagram bio / story link
          conversions: 8,
          revenue_generated: 450000,
          watch_time_seconds: 18.0,
          retention_rate_pct: 54.0,
          data_source: "connected_account" as const,
          is_manual_entry: false,
          account_id: "acc-1",
          last_synced_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const overview = analyticsService.calculateOverviewMetrics("ws-1", mockItems, "30d");

      expect(overview.totalViews).toBe(30000);
      // Engagement: (800+100+50+150) + (1500+200+300+400) = 1100 + 2400 = 3500
      expect(overview.totalEngagement).toBe(3500);
      // Engagement rate: (3500 / 30000) * 100 = 11.67%
      expect(Number(overview.averageEngagementRate.toFixed(2))).toBe(11.67);
      
      // Verified clicks and conversions
      expect(overview.totalClicks).toBe(120);
      expect(overview.totalConversions).toBe(8);

      // Data provenance: 1 manual, 1 connected
      expect(overview.dataSourcesSummary.manual).toBe(1);
      expect(overview.dataSourcesSummary.connected).toBe(1);

      // Platform breakdown
      expect(overview.platforms).toHaveLength(2);
      const tiktokPlatform = overview.platforms.find((p) => p.platform === "tiktok");
      expect(tiktokPlatform?.totalViews).toBe(10000);
      expect(tiktokPlatform?.clicks).toBeNull(); // Not fabricated!
      expect(tiktokPlatform?.conversions).toBeNull(); // Not fabricated!
    });

    it("returns null for clicks and conversions when none of the content items have tracking", () => {
      const mockItems = [
        {
          id: "snap-1",
          workspace_id: "ws-1",
          content_item_id: null,
          platform: "tiktok" as const,
          post_title: "Video 1 TikTok",
          post_url: null,
          external_post_id: null,
          published_at: null,
          snapshot_date: "2026-10-30",
          views: 5000,
          likes: 200,
          comments: 20,
          shares: 10,
          saves: 15,
          clicks: null,
          conversions: null,
          revenue_generated: null,
          watch_time_seconds: null,
          retention_rate_pct: null,
          data_source: "manual_entry" as const,
          is_manual_entry: true,
          account_id: null,
          last_synced_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const overview = analyticsService.calculateOverviewMetrics("ws-1", mockItems, "7d");
      expect(overview.totalClicks).toBeNull();
      expect(overview.totalConversions).toBeNull();
      expect(overview.totalViews).toBe(5000);
    });
  });
});
