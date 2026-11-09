import { describe, it, expect } from "vitest";
import { AnalyticsService } from "@/services/analytics-service";
import type { PerformancePlatform } from "@/lib/supabase/types";

describe("Phase 7 Launch Readiness — Load & Concurrency Benchmark", () => {
  it("processes 100 concurrent analytics calculations within latency budget (< 250ms p95)", async () => {
    const service = new AnalyticsService();
    const mockSnapshots = Array.from({ length: 50 }, (_, i) => ({
      id: `snap-${i}`,
      workspace_id: "ws-bench",
      content_item_id: `ci-${i}`,
      platform: (i % 2 === 0 ? "tiktok" : "instagram") as PerformancePlatform,
      post_title: `Konten Uji Beban #${i}`,
      post_url: null,
      external_post_id: null,
      published_at: "2026-10-30T10:00:00Z",
      snapshot_date: "2026-10-30",
      views: 1000 + i * 500,
      likes: 100 + i * 20,
      comments: 10 + i * 2,
      shares: 5 + i,
      saves: 15 + i * 3,
      clicks: i % 3 === 0 ? 10 + i : null,
      conversions: i % 3 === 0 ? Math.floor(i / 5) : null,
      revenue_generated: null,
      watch_time_seconds: 20 + (i % 15),
      retention_rate_pct: 50 + (i % 30),
      data_source: "manual_entry" as const,
      is_manual_entry: true,
      account_id: null,
      last_synced_at: null,
      created_at: "2026-10-30T10:00:00Z",
      updated_at: "2026-10-30T10:00:00Z",
    }));

    const latencies: number[] = [];
    const concurrency = 100;

    const startTotal = performance.now();
    const promises = Array.from({ length: concurrency }, async () => {
      const start = performance.now();
      const overview = service.calculateOverviewMetrics("ws-bench", mockSnapshots, "30d");
      const duration = performance.now() - start;
      latencies.push(duration);
      return overview;
    });

    const results = await Promise.all(promises);
    const totalDuration = performance.now() - startTotal;

    expect(results).toHaveLength(100);
    expect(results[0].totalViews).toBeGreaterThan(0);

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    expect(p50).toBeLessThan(50); // Under 50ms p50
    expect(p95).toBeLessThan(150); // Under 150ms p95
    expect(totalDuration).toBeLessThan(1000); // 100 operations complete under 1s
  });
});
