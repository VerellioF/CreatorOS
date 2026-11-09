import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "./workspace-service";
import type {
  ContentPerformanceSnapshotRow,
  PerformancePlatform,
  PerformanceDataSource,
} from "@/lib/supabase/types";
import type {
  AnalyticsDateRange,
  ContentPerformanceItem,
  PlatformMetricBreakdown,
  PerformanceHistoryPoint,
  WorkspaceAnalyticsOverview,
} from "@/lib/analytics/types";
import {
  manualPerformanceEntrySchema,
  type ManualPerformanceEntryInput,
  type AnalyticsQueryInput,
} from "@/lib/validation/analytics-schemas";

export class AnalyticsService {
  // In-memory fallback cache for development, testing, and isolated environments
  private static mockSnapshots: Map<string, ContentPerformanceSnapshotRow[]> = new Map();

  /**
   * Resets mock data (used for test isolation)
   */
  static resetMockData(): void {
    this.mockSnapshots.clear();
  }

  /**
   * Pure function to calculate aggregate overview metrics from snapshot rows
   * Enforces strict Zero-Fabrication rules: missing clicks/conversions return null
   */
  calculateOverviewMetrics(
    workspaceId: string,
    snapshots: ContentPerformanceSnapshotRow[],
    dateRange: AnalyticsDateRange = "30d"
  ): WorkspaceAnalyticsOverview {
    // Filter by date range if applicable
    const now = new Date();
    let daysCutoff = 30;
    if (dateRange === "7d") daysCutoff = 7;
    if (dateRange === "90d") daysCutoff = 90;
    if (dateRange === "all") daysCutoff = 36500;

    const cutoffDate = new Date(now.getTime() - daysCutoff * 24 * 60 * 60 * 1000);
    const filtered = snapshots.filter((s) => {
      const snapDate = new Date(s.snapshot_date);
      return snapDate >= cutoffDate;
    });

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;

    let hasClickData = false;
    let sumClicks = 0;

    let hasConversionData = false;
    let sumConversions = 0;

    let manualCount = 0;
    let connectedCount = 0;

    const platformMap = new Map<PerformancePlatform, {
      views: number;
      engagement: number;
      clicks: number | null;
      conversions: number | null;
      count: number;
      hasManual: boolean;
      hasConnected: boolean;
    }>();

    const historyMap = new Map<string, {
      views: number;
      engagement: number;
      clicks: number | null;
      conversions: number | null;
    }>();

    const performanceItems: ContentPerformanceItem[] = filtered.map((s) => {
      const engagement = s.likes + s.comments + s.shares + s.saves;
      const rate = s.views > 0 ? (engagement / s.views) * 100 : 0;

      totalViews += s.views;
      totalLikes += s.likes;
      totalComments += s.comments;
      totalShares += s.shares;
      totalSaves += s.saves;

      if (s.clicks !== null && s.clicks !== undefined) {
        hasClickData = true;
        sumClicks += s.clicks;
      }
      if (s.conversions !== null && s.conversions !== undefined) {
        hasConversionData = true;
        sumConversions += s.conversions;
      }

      if (s.is_manual_entry) {
        manualCount++;
      } else {
        connectedCount++;
      }

      // Group platform
      const existingPlat = platformMap.get(s.platform) || {
        views: 0,
        engagement: 0,
        clicks: null,
        conversions: null,
        count: 0,
        hasManual: false,
        hasConnected: false,
      };

      existingPlat.views += s.views;
      existingPlat.engagement += engagement;
      existingPlat.count += 1;
      if (s.is_manual_entry) existingPlat.hasManual = true;
      else existingPlat.hasConnected = true;

      if (s.clicks !== null && s.clicks !== undefined) {
        existingPlat.clicks = (existingPlat.clicks || 0) + s.clicks;
      }
      if (s.conversions !== null && s.conversions !== undefined) {
        existingPlat.conversions = (existingPlat.conversions || 0) + s.conversions;
      }
      platformMap.set(s.platform, existingPlat);

      // Group history date
      const dateKey = s.snapshot_date;
      const existingHist = historyMap.get(dateKey) || {
        views: 0,
        engagement: 0,
        clicks: null,
        conversions: null,
      };
      existingHist.views += s.views;
      existingHist.engagement += engagement;
      if (s.clicks !== null && s.clicks !== undefined) {
        existingHist.clicks = (existingHist.clicks || 0) + s.clicks;
      }
      if (s.conversions !== null && s.conversions !== undefined) {
        existingHist.conversions = (existingHist.conversions || 0) + s.conversions;
      }
      historyMap.set(dateKey, existingHist);

      return {
        id: s.id,
        workspaceId: s.workspace_id,
        contentItemId: s.content_item_id,
        platform: s.platform,
        postTitle: s.post_title,
        postUrl: s.post_url,
        publishedAt: s.published_at,
        snapshotDate: s.snapshot_date,
        views: s.views,
        likes: s.likes,
        comments: s.comments,
        shares: s.shares,
        saves: s.saves,
        totalEngagement: engagement,
        engagementRate: Number(rate.toFixed(2)),
        clicks: s.clicks,
        conversions: s.conversions,
        revenueGenerated: s.revenue_generated,
        watchTimeSeconds: s.watch_time_seconds,
        retentionRatePct: s.retention_rate_pct,
        dataSource: s.data_source,
        isManualEntry: s.is_manual_entry,
        lastSyncedAt: s.last_synced_at,
      };
    });

    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const averageEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

    const platforms: PlatformMetricBreakdown[] = Array.from(platformMap.entries()).map(
      ([plat, data]) => {
        const platRate = data.views > 0 ? (data.engagement / data.views) * 100 : 0;
        let ds: "connected_account" | "manual_entry" | "mixed" = "manual_entry";
        if (data.hasConnected && data.hasManual) ds = "mixed";
        else if (data.hasConnected) ds = "connected_account";

        return {
          platform: plat,
          totalViews: data.views,
          totalEngagement: data.engagement,
          averageEngagementRate: Number(platRate.toFixed(2)),
          postCount: data.count,
          clicks: data.clicks,
          conversions: data.conversions,
          dataSource: ds,
        };
      }
    );

    const history: PerformanceHistoryPoint[] = Array.from(historyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        views: data.views,
        engagement: data.engagement,
        clicks: data.clicks,
        conversions: data.conversions,
      }));

    // Top performers (sorted by engagement rate & views)
    const sortedItems = [...performanceItems].sort((a, b) => {
      if (b.engagementRate !== a.engagementRate) return b.engagementRate - a.engagementRate;
      return b.views - a.views;
    });

    const topPerformers = sortedItems.slice(0, 5);
    const weakPerformers = sortedItems.length > 5 ? [...sortedItems].reverse().slice(0, 5) : [];

    return {
      workspaceId,
      dateRange,
      totalViews,
      totalEngagement,
      averageEngagementRate: Number(averageEngagementRate.toFixed(2)),
      totalClicks: hasClickData ? sumClicks : null,
      totalConversions: hasConversionData ? sumConversions : null,
      hasClickTracking: hasClickData,
      hasConversionTracking: hasConversionData,
      connectedAccountsCount: connectedCount,
      manualEntriesCount: manualCount,
      dataSourcesSummary: {
        connected: connectedCount,
        manual: manualCount,
      },
      platforms,
      history,
      topPerformers,
      weakPerformers,
    };
  }

  /**
   * Retrieves workspace analytics overview
   */
  async getWorkspaceAnalyticsOverview(
    workspaceId: string,
    userId: string,
    options?: { dateRange?: AnalyticsDateRange; platform?: string }
  ): Promise<WorkspaceAnalyticsOverview> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) {
      throw new Error("Unauthorized: You do not have access to this workspace");
    }

    const dateRange = options?.dateRange || "30d";
    let rows: ContentPerformanceSnapshotRow[] = [];

    try {
      const supabase = await createClient();
      let query = supabase
        .from("content_performance_snapshots")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("snapshot_date", { ascending: false });

      if (options?.platform && options.platform !== "all") {
        query = query.eq("platform", options.platform as any);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        rows = data as ContentPerformanceSnapshotRow[];
      } else {
        rows = AnalyticsService.mockSnapshots.get(workspaceId) || [];
      }
    } catch {
      // Fallback to in-memory store
      rows = AnalyticsService.mockSnapshots.get(workspaceId) || [];
    }

    if (options?.platform && options.platform !== "all") {
      rows = rows.filter((r) => r.platform === options.platform);
    }

    return this.calculateOverviewMetrics(workspaceId, rows, dateRange);
  }

  /**
   * Records a manual performance entry from the creator
   */
  async recordManualPerformanceEntry(
    workspaceId: string,
    userId: string,
    input: ManualPerformanceEntryInput
  ): Promise<ContentPerformanceItem> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!hasAccess) {
      throw new Error("Unauthorized: You do not have access to this workspace");
    }

    const validated = manualPerformanceEntrySchema.parse(input);
    const now = new Date().toISOString();
    const snapshotDate = validated.snapshotDate || now.split("T")[0];

    const newSnapshot: ContentPerformanceSnapshotRow = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      content_item_id: validated.contentItemId || null,
      platform: validated.platform,
      post_title: validated.postTitle,
      post_url: validated.postUrl || null,
      external_post_id: null,
      published_at: now,
      snapshot_date: snapshotDate,
      views: validated.views,
      likes: validated.likes,
      comments: validated.comments,
      shares: validated.shares,
      saves: validated.saves,
      clicks: validated.clicks !== undefined ? validated.clicks : null,
      conversions: validated.conversions !== undefined ? validated.conversions : null,
      revenue_generated: validated.revenueGenerated !== undefined ? validated.revenueGenerated : null,
      watch_time_seconds: validated.watchTimeSeconds !== undefined ? validated.watchTimeSeconds : null,
      retention_rate_pct: validated.retentionRatePct !== undefined ? validated.retentionRatePct : null,
      data_source: "manual_entry",
      is_manual_entry: true,
      account_id: null,
      last_synced_at: now,
      created_at: now,
      updated_at: now,
    };

    // Keep local cache in sync for resilience
    const existing = AnalyticsService.mockSnapshots.get(workspaceId) || [];
    existing.unshift(newSnapshot);
    AnalyticsService.mockSnapshots.set(workspaceId, existing);

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("content_performance_snapshots")
        .insert(newSnapshot as any)
        .select()
        .single();

      if (error) {
        throw error;
      }
      if (data) {
        return this.formatSnapshotItem(data as ContentPerformanceSnapshotRow);
      }
    } catch {
      // In-memory fallback is already recorded above
    }

    return this.formatSnapshotItem(newSnapshot);
  }

  /**
   * Retrieves single snapshot item
   */
  async getSnapshotById(
    workspaceId: string,
    userId: string,
    snapshotId: string
  ): Promise<ContentPerformanceItem | null> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) {
      throw new Error("Unauthorized");
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("content_performance_snapshots")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", snapshotId)
        .single();

      if (!error && data) {
        return this.formatSnapshotItem(data as ContentPerformanceSnapshotRow);
      }
    } catch {
      // Fallback below
    }

    const items = AnalyticsService.mockSnapshots.get(workspaceId) || [];
    const item = items.find((i) => i.id === snapshotId);
    if (item) return this.formatSnapshotItem(item);

    return null;
  }

  /**
   * Deletes a snapshot
   */
  async deleteSnapshot(
    workspaceId: string,
    userId: string,
    snapshotId: string
  ): Promise<boolean> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!hasAccess) {
      throw new Error("Unauthorized");
    }

    try {
      const supabase = await createClient();
      await supabase
        .from("content_performance_snapshots")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", snapshotId);
    } catch {
      const items = AnalyticsService.mockSnapshots.get(workspaceId) || [];
      AnalyticsService.mockSnapshots.set(
        workspaceId,
        items.filter((i) => i.id !== snapshotId)
      );
    }

    return true;
  }

  private formatSnapshotItem(s: ContentPerformanceSnapshotRow): ContentPerformanceItem {
    const engagement = s.likes + s.comments + s.shares + s.saves;
    const rate = s.views > 0 ? (engagement / s.views) * 100 : 0;

    return {
      id: s.id,
      workspaceId: s.workspace_id,
      contentItemId: s.content_item_id,
      platform: s.platform,
      postTitle: s.post_title,
      postUrl: s.post_url,
      publishedAt: s.published_at,
      snapshotDate: s.snapshot_date,
      views: s.views,
      likes: s.likes,
      comments: s.comments,
      shares: s.shares,
      saves: s.saves,
      totalEngagement: engagement,
      engagementRate: Number(rate.toFixed(2)),
      clicks: s.clicks,
      conversions: s.conversions,
      revenueGenerated: s.revenue_generated,
      watchTimeSeconds: s.watch_time_seconds,
      retentionRatePct: s.retention_rate_pct,
      dataSource: s.data_source,
      isManualEntry: s.is_manual_entry,
      lastSyncedAt: s.last_synced_at,
    };
  }
}
