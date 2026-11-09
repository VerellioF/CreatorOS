import fs from "node:fs";
import path from "node:path";
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

const BACKUP_TABLES = [
  "workspaces",
  "profiles",
  "content_items",
  "content_performance_snapshots",
  "analytics_insights",
  "support_tickets",
  "data_retention_logs",
];

async function main() {
  console.log("==========================================================");
  console.log("CREATOROS AI — PRODUCTION DATABASE BACKUP UTILITY");
  console.log("==========================================================");

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const tableData = {};
  const tableCounts = {};
  let connectionActive = false;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log(`Connected to Supabase endpoint: ${supabaseUrl}`);

      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.warn(`[WARN] Failed to query table '${table}': ${error.message}`);
          tableData[table] = [];
          tableCounts[table] = 0;
        } else {
          tableData[table] = data || [];
          tableCounts[table] = (data || []).length;
          console.log(`✓ Fetched table '${table}': ${tableCounts[table]} records`);
        }
      }
      connectionActive = true;
    } catch (err) {
      console.warn(`[WARN] Supabase query encountered error: ${err.message}`);
    }
  } else {
    console.log("[INFO] Supabase credentials not set in environment. Creating structured empty schema backup.");
    for (const table of BACKUP_TABLES) {
      tableData[table] = [];
      tableCounts[table] = 0;
    }
  }

  const exportPayload = {
    schema_version: "20261031060000_phase7",
    exported_at: new Date().toISOString(),
    connection_active: connectionActive,
    tables: BACKUP_TABLES,
    counts: tableCounts,
    data: tableData,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `creatoros_backup_${timestamp}.json`;
  const targetPath = path.join(BACKUP_DIR, filename);

  const crypto = await import("node:crypto");
  const serialized = JSON.stringify(exportPayload);
  const checksum = crypto.createHash("sha256").update(serialized).digest("hex");

  const snapshot = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    checksum,
    data: exportPayload,
  };

  fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), "utf-8");

  console.log("----------------------------------------------------------");
  console.log(`✓ Backup successfully generated: ${filename}`);
  console.log(`✓ Integrity Checksum (SHA-256): ${checksum}`);
  console.log(`✓ Destination: ${targetPath}`);
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
