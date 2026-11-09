import { describe, it, expect, beforeEach } from "vitest";
import { DataRetentionService } from "@/services/data-retention-service";

describe("Phase 7 Production Operations — Data Retention & Scheduled Cleanup", () => {
  beforeEach(() => {
    DataRetentionService.resetMockData();
  });

  it("evaluates retention policies in dry-run mode and calculates eligible purge items", async () => {
    const service = new DataRetentionService();

    // Populate expired items (older than 90 days)
    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    DataRetentionService.seedMockLogs([
      { id: "log-1", workspace_id: "ws-1", created_at: oldDate },
      { id: "log-2", workspace_id: "ws-1", created_at: oldDate },
      { id: "log-3", workspace_id: "ws-1", created_at: recentDate },
    ]);

    const dryRunResult = await service.executeRetentionCleanup("ws-1", { dryRun: true });
    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.eligibleItems).toBe(2);
    expect(dryRunResult.purgedItems).toBe(0);

    // Now execute actual purge
    const purgeResult = await service.executeRetentionCleanup("ws-1", { dryRun: false });
    expect(purgeResult.dryRun).toBe(false);
    expect(purgeResult.purgedItems).toBe(2);

    // Verify remaining
    const remaining = DataRetentionService.getMockLogs("ws-1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("log-3");
  });
});
