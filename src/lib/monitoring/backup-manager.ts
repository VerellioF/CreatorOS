import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface DatabaseSnapshot<T = any> {
  version: string;
  timestamp: string;
  checksum: string;
  data: T;
}

export interface SnapshotVerificationResult {
  isValid: boolean;
  checksumMatch: boolean;
  computedChecksum: string;
  expectedChecksum: string;
}

export class DatabaseBackupManager {
  /**
   * Generates a SHA-256 hash of a serializable object
   */
  static computeChecksum(data: any): string {
    const serialized = JSON.stringify(data);
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Creates a snapshot of data and writes it to a file with integrity checksum
   */
  static createSnapshot<T = any>(data: T, targetPath: string): DatabaseSnapshot<T> {
    const checksum = this.computeChecksum(data);
    const snapshot: DatabaseSnapshot<T> = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      checksum,
      data,
    };

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), "utf-8");
    return snapshot;
  }

  /**
   * Verifies the SHA-256 integrity of a snapshot file
   */
  static verifySnapshot(snapshotPath: string): SnapshotVerificationResult {
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(`Snapshot file not found: ${snapshotPath}`);
    }

    const content = fs.readFileSync(snapshotPath, "utf-8");
    const snapshot: DatabaseSnapshot = JSON.parse(content);

    const computedChecksum = this.computeChecksum(snapshot.data);
    const checksumMatch = computedChecksum === snapshot.checksum;

    return {
      isValid: checksumMatch,
      checksumMatch,
      computedChecksum,
      expectedChecksum: snapshot.checksum,
    };
  }

  /**
   * Restores data from a verified snapshot
   */
  static restoreSnapshot<T = any>(snapshotPath: string): T {
    const verification = this.verifySnapshot(snapshotPath);
    if (!verification.isValid) {
      throw new Error(
        `Integrity verification failed! Checksum mismatch: expected ${verification.expectedChecksum}, got ${verification.computedChecksum}`
      );
    }

    const content = fs.readFileSync(snapshotPath, "utf-8");
    const snapshot: DatabaseSnapshot<T> = JSON.parse(content);
    return snapshot.data;
  }
}
