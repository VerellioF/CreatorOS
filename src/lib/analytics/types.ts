import type {
  PerformancePlatform,
  PerformanceDataSource,
  ContentPerformanceSnapshotRow,
} from "@/lib/supabase/types";

export type AnalyticsDateRange = "7d" | "30d" | "90d" | "all";

export interface ContentPerformanceItem {
  id: string;
  workspaceId: string;
  contentItemId: string | null;
  platform: PerformancePlatform;
  postTitle: string;
  postUrl: string | null;
  publishedAt: string | null;
  snapshotDate: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  totalEngagement: number;
  engagementRate: number;
  clicks: number | null;
  conversions: number | null;
  revenueGenerated: number | null;
  watchTimeSeconds: number | null;
  retentionRatePct: number | null;
  dataSource: PerformanceDataSource;
  isManualEntry: boolean;
  lastSyncedAt: string | null;
}

export interface PlatformMetricBreakdown {
  platform: PerformancePlatform;
  totalViews: number;
  totalEngagement: number;
  averageEngagementRate: number;
  postCount: number;
  clicks: number | null;
  conversions: number | null;
  dataSource: "connected_account" | "manual_entry" | "mixed";
}

export interface PerformanceHistoryPoint {
  date: string;
  views: number;
  engagement: number;
  clicks: number | null;
  conversions: number | null;
}

export interface WorkspaceAnalyticsOverview {
  workspaceId: string;
  dateRange: AnalyticsDateRange;
  totalViews: number;
  totalEngagement: number;
  averageEngagementRate: number;
  totalClicks: number | null;
  totalConversions: number | null;
  hasClickTracking: boolean;
  hasConversionTracking: boolean;
  connectedAccountsCount: number;
  manualEntriesCount: number;
  dataSourcesSummary: {
    connected: number;
    manual: number;
  };
  platforms: PlatformMetricBreakdown[];
  history: PerformanceHistoryPoint[];
  topPerformers: ContentPerformanceItem[];
  weakPerformers: ContentPerformanceItem[];
}
