import { describe, it, expect, beforeEach } from "vitest";
import { AIAnalystService } from "@/services/ai-analyst-service";
import type { ContentPerformanceSnapshotRow } from "@/lib/supabase/types";

describe("Phase 7 AI Analyst Service & Traceable Recommendations", () => {
  let analystService: AIAnalystService;

  beforeEach(() => {
    analystService = new AIAnalystService();
  });

  const mockSnapshots: ContentPerformanceSnapshotRow[] = [
    {
      id: "post-top-1",
      workspace_id: "ws-1",
      content_item_id: "ci-1",
      platform: "tiktok",
      post_title: "3 Kesalahan Fatal Pemula Saat Beli Saham",
      post_url: "https://tiktok.com/@creator/video/1",
      external_post_id: null,
      published_at: "2026-10-25T10:00:00Z",
      snapshot_date: "2026-10-25",
      views: 75000,
      likes: 6200,
      comments: 480,
      shares: 1100,
      saves: 2300,
      clicks: null,
      conversions: null,
      revenue_generated: null,
      watch_time_seconds: 38.5,
      retention_rate_pct: 74.2,
      data_source: "manual_entry",
      is_manual_entry: true,
      account_id: null,
      last_synced_at: null,
      created_at: "2026-10-25T10:00:00Z",
      updated_at: "2026-10-25T10:00:00Z",
    },
    {
      id: "post-top-2",
      workspace_id: "ws-1",
      content_item_id: "ci-2",
      platform: "instagram",
      post_title: "Kenapa Gaji 10 Juta Masih Ngerasa Miskin?",
      post_url: "https://instagram.com/reel/2",
      external_post_id: null,
      published_at: "2026-10-27T11:00:00Z",
      snapshot_date: "2026-10-27",
      views: 45000,
      likes: 3900,
      comments: 320,
      shares: 720,
      saves: 1400,
      clicks: 85,
      conversions: 6,
      revenue_generated: 300000,
      watch_time_seconds: 29.0,
      retention_rate_pct: 65.0,
      data_source: "connected_account",
      is_manual_entry: false,
      account_id: "acc-1",
      last_synced_at: "2026-10-27T11:00:00Z",
      created_at: "2026-10-27T11:00:00Z",
      updated_at: "2026-10-27T11:00:00Z",
    },
    {
      id: "post-weak-1",
      workspace_id: "ws-1",
      content_item_id: "ci-3",
      platform: "youtube",
      post_title: "Pengenalan Indeks Saham Gabungan Bab 1",
      post_url: "https://youtube.com/watch?v=3",
      external_post_id: null,
      published_at: "2026-10-29T14:00:00Z",
      snapshot_date: "2026-10-29",
      views: 1200,
      likes: 35,
      comments: 4,
      shares: 2,
      saves: 5,
      clicks: null,
      conversions: null,
      revenue_generated: null,
      watch_time_seconds: 12.0,
      retention_rate_pct: 18.5,
      data_source: "manual_entry",
      is_manual_entry: true,
      account_id: null,
      last_synced_at: null,
      created_at: "2026-10-29T14:00:00Z",
      updated_at: "2026-10-29T14:00:00Z",
    },
  ];

  it("synthesizes deep diagnostic report with traceable evidence", async () => {
    const report = await analystService.generateDiagnosticsFromSnapshots("ws-1", mockSnapshots, {
      activePillars: [
        { name: "Edukasi Finansial", targetPercentage: 50 },
        { name: "Opini Market", targetPercentage: 30 },
        { name: "Life & Mindset", targetPercentage: 20 },
      ],
    });

    // 1. Performance Grade
    expect(["A", "B", "C", "D"]).toContain(report.performanceGrade);

    // 2. Top and Weak Performer Identification
    expect(report.topPerformers.length).toBeGreaterThan(0);
    const topIds = report.topPerformers.map((t) => t.id);
    expect(topIds).toContain("post-top-1");
    expect(topIds).toContain("post-top-2");
    expect(report.topPerformers.some((t) => t.views === 75000)).toBe(true);
    expect(report.topPerformers[0].reasonForSuccess).toBeTruthy();

    expect(report.weakPerformers.length).toBeGreaterThan(0);
    expect(report.weakPerformers[0].id).toBe("post-weak-1");
    expect(report.weakPerformers[0].diagnosticReason).toBeTruthy();

    // 3. Content Patterns & Audience Response
    expect(report.contentPatterns.length).toBeGreaterThan(0);
    expect(report.audienceResponse.viralPotentialRatio).toBeGreaterThan(0);

    // 4. Traceable Recommendations with Evidence citations
    expect(report.recommendations.length).toBeGreaterThan(0);
    for (const rec of report.recommendations) {
      expect(rec.action).toBeTruthy();
      expect(rec.explanation).toBeTruthy();
      expect(rec.evidence.length).toBeGreaterThan(0);
      expect(rec.evidence[0].contentId).toBeTruthy();
      expect(rec.evidence[0].metricObserved).toBeTruthy();
    }

    // 5. Strategy Alignment Check
    expect(report.strategyAlignment.overallAlignmentScore).toBeGreaterThanOrEqual(0);
    expect(report.strategyAlignment.pillarCoverage.length).toBeGreaterThan(0);
  });
});
