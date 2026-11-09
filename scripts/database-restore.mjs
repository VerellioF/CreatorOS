import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const BACKUP_DIR = path.join(REPO_ROOT, "backups");

// Attempt to load .env or .env.local if available
for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(REPO_ROOT, envFile);
  if (fs.existsSync(envPath) && process.loadEnvFile) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log("==========================================================");
  console.log("CREATOROS AI — DATABASE RESTORE & INTEGRITY VERIFIER");
  console.log("==========================================================");

  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const targetFile = args.find((a) => !a.startsWith("--"));

  let snapshotPath = targetFile;

  if (!snapshotPath) {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log("No backups directory found.");
      return;
    }
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      console.log("No backup snapshots found in backups/ directory.");
      return;
    }
    files.sort();
    snapshotPath = path.join(BACKUP_DIR, files[files.length - 1]);
  }

  console.log(`Verifying backup snapshot: ${snapshotPath}`);
  const content = fs.readFileSync(snapshotPath, "utf-8");
  const snapshot = JSON.parse(content);

  const serialized = JSON.stringify(snapshot.data);
  const computedChecksum = crypto.createHash("sha256").update(serialized).digest("hex");

  if (computedChecksum !== snapshot.checksum) {
    throw new Error(
      `Fatal: Snapshot checksum validation failed! Expected ${snapshot.checksum}, computed ${computedChecksum}`
    );
  }

  console.log(`✓ Checksum verified [SHA-256 MATCH]: ${computedChecksum}`);
  console.log(`✓ Schema Version: ${snapshot.data.schema_version || "unknown"}`);
  console.log(`✓ Exported At: ${snapshot.data.exported_at || snapshot.timestamp}`);

  const tables = snapshot.data.tables || Object.keys(snapshot.data.counts || {});
  console.log(`✓ Tables in Snapshot (${tables.length}):`);
  for (const t of tables) {
    const count = snapshot.data.counts?.[t] ?? (Array.isArray(snapshot.data.data?.[t]) ? snapshot.data.data[t].length : 0);
    console.log(`   - ${t}: ${count} rows`);
  }

  if (isExecute) {
    console.log("----------------------------------------------------------");
    console.log("EXECUTION MODE: Restoring records to Supabase...");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials (URL and Key) are required to execute database restore.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    for (const t of tables) {
      const rows = snapshot.data.data?.[t];
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`Restoring ${rows.length} rows to ${t}...`);
        const { error } = await supabase.from(t).upsert(rows);
        if (error) {
          console.error(`Failed to restore table ${t}:`, error.message);
        } else {
          console.log(`✓ Restored ${rows.length} rows to ${t}`);
        }
      }
    }
    console.log("✓ Database restore execution completed.");
  } else {
    console.log("----------------------------------------------------------");
    console.log("DRY-RUN MODE: Verification passed. Pass '--execute' to write records to Supabase.");
  }
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("Restore verification failed:", err);
  process.exit(1);
});
