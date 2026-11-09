import { z } from "zod";

export const performancePlatformEnum = z.enum([
  "tiktok",
  "instagram",
  "youtube",
  "facebook",
  "shopee_video",
  "other",
]);

export const performanceDataSourceEnum = z.enum([
  "connected_account",
  "manual_entry",
  "api_sync",
]);

export const manualPerformanceEntrySchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  contentItemId: z.string().uuid("Invalid content item ID").optional().nullable(),
  platform: performancePlatformEnum,
  postTitle: z.string().min(2, "Judul konten minimal 2 karakter").max(200, "Judul konten maksimal 200 karakter"),
  postUrl: z.string().url("URL konten tidak valid").optional().nullable().or(z.literal("")),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD").optional(),
  views: z.number().int().min(0, "Views tidak boleh negatif"),
  likes: z.number().int().min(0, "Likes tidak boleh negatif"),
  comments: z.number().int().min(0, "Comments tidak boleh negatif"),
  shares: z.number().int().min(0, "Shares tidak boleh negatif"),
  saves: z.number().int().min(0, "Saves tidak boleh negatif"),
  clicks: z.number().int().min(0).optional().nullable(),
  conversions: z.number().int().min(0).optional().nullable(),
  revenueGenerated: z.number().min(0).optional().nullable(),
  watchTimeSeconds: z.number().min(0).optional().nullable(),
  retentionRatePct: z.number().min(0).max(100).optional().nullable(),
});

export type ManualPerformanceEntryInput = z.infer<typeof manualPerformanceEntrySchema>;

export const analyticsQuerySchema = z.object({
  dateRange: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
  platform: performancePlatformEnum.optional(),
  sortBy: z.enum(["views", "engagement", "date"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
