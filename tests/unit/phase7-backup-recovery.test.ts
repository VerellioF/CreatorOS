import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseBackupManager } from "@/lib/monitoring/backup-manager";

describe("Phase 7 Production Operations — Database Backup & Recovery", () => {
  const tempDir = path.resolve(process.cwd(), ".tmp-backup-test");

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("creates a tamper-evident database snapshot with valid SHA-256 checksum and verifies recovery", () => {
    const mockDbData = {
      workspaces: [{ id: "ws-1", name: "Creator Studio" }],
      content_performance_snapshots: [
        { id: "snap-1", workspace_id: "ws-1", views: 25000 },
      ],
      support_tickets: [
        { id: "ticket-1", workspace_id: "ws-1", subject: "Pertanyaan Billing" },
      ],
    };

    // 1. Create backup snapshot
    const backupFile = path.join(tempDir, "backup-test.json");
    const snapshot = DatabaseBackupManager.createSnapshot(mockDbData, backupFile);

    expect(snapshot.checksum).toBeTruthy();
    expect(snapshot.timestamp).toBeTruthy();
    expect(fs.existsSync(backupFile)).toBe(true);

    // 2. Verify snapshot integrity
    const verification = DatabaseBackupManager.verifySnapshot(backupFile);
    expect(verification.isValid).toBe(true);
    expect(verification.checksumMatch).toBe(true);

    // 3. Test restoration
    const restoredData = DatabaseBackupManager.restoreSnapshot(backupFile);
    expect(restoredData.workspaces).toHaveLength(1);
    expect(restoredData.content_performance_snapshots[0].views).toBe(25000);

    // 4. Test tamper detection
    const fileContent = JSON.parse(fs.readFileSync(backupFile, "utf-8"));
    fileContent.data.workspaces[0].name = "Hacked Workspace";
    fs.writeFileSync(backupFile, JSON.stringify(fileContent));

    const tamperedVerification = DatabaseBackupManager.verifySnapshot(backupFile);
    expect(tamperedVerification.isValid).toBe(false);
    expect(tamperedVerification.checksumMatch).toBe(false);
    expect(() => DatabaseBackupManager.restoreSnapshot(backupFile)).toThrow(
      /Integrity verification failed/
    );
  });
});
