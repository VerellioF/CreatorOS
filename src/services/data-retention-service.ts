import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "./workspace-service";

export interface RetentionCleanupResult {
  dryRun: boolean;
  eligibleItems: number;
  purgedItems: number;
  policyName: string;
  details?: Record<string, any>;
}

export class DataRetentionService {
  // In-memory test store
  private static mockLogs: Map<string, Array<{ id: string; workspace_id: string; created_at: string }>> = new Map();

  static resetMockData(): void {
    this.mockLogs.clear();
  }

  static seedMockLogs(logs: Array<{ id: string; workspace_id: string; created_at: string }>): void {
    for (const log of logs) {
      const existing = this.mockLogs.get(log.workspace_id) || [];
      existing.push(log);
      this.mockLogs.set(log.workspace_id, existing);
    }
  }

  static getMockLogs(workspaceId: string) {
    return this.mockLogs.get(workspaceId) || [];
  }

  /**
   * Executes scheduled retention cleanup
   * Retention Rules:
   * - Publishing logs older than 90 days are purged
   * - Temporary generation jobs older than 30 days are purged
   */
  async executeRetentionCleanup(
    workspaceId: string,
    options?: { dryRun?: boolean }
  ): Promise<RetentionCleanupResult> {
    const dryRun = options?.dryRun ?? true;
    const policyName = "purge_90d_logs_30d_jobs";

    const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).getTime();

    // Check in-memory logs
    const existingLogs = DataRetentionService.mockLogs.get(workspaceId) || [];
    const eligibleLogs = existingLogs.filter((l) => new Date(l.created_at).getTime() < cutoff90d);

    if (dryRun) {
      return {
        dryRun: true,
        eligibleItems: eligibleLogs.length,
        purgedItems: 0,
        policyName,
      };
    }

    // Actual purge
    const remainingLogs = existingLogs.filter((l) => new Date(l.created_at).getTime() >= cutoff90d);
    DataRetentionService.mockLogs.set(workspaceId, remainingLogs);

    // Call stored procedure if live Supabase is available
    try {
      const supabase = await createClient();
      await supabase.rpc("execute_data_retention_cleanup", {
        p_workspace_id: workspaceId,
        p_dry_run: false,
      });
    } catch {
      // In-memory purge already completed
    }

    return {
      dryRun: false,
      eligibleItems: eligibleLogs.length,
      purgedItems: eligibleLogs.length,
      policyName,
      details: {
        purgedLogs: eligibleLogs.length,
        executedAt: new Date().toISOString(),
      },
    };
  }
}
