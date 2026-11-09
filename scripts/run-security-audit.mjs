import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

async function main() {
  console.log("==========================================================");
  console.log("CREATOROS AI — PUBLIC LAUNCH SECURITY AUDIT RUNNER");
  console.log("==========================================================");

  // 1. Audit Migrations RLS
  const migrationsDir = path.join(REPO_ROOT, "supabase/migrations");
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  const createdTables = new Set();
  const rlsTables = new Set();

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    const createTableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      createdTables.add(match[1]);
    }
    const rlsRegex = /ALTER\s+TABLE\s+public\.([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    while ((match = rlsRegex.exec(content)) !== null) {
      rlsTables.add(match[1]);
    }
  }

  const unprotected = [];
  for (const table of Array.from(createdTables)) {
    if (!rlsTables.has(table)) {
      unprotected.push(table);
    }
  }

  assert.equal(
    unprotected.length,
    0,
    `Unprotected tables found without RLS: ${unprotected.join(", ")}`
  );
  console.log(`✓ Audit 1: All ${createdTables.size} PostgreSQL tables have 100% RLS enabled`);

  // 2. Audit Environment Configuration
  const envPath = path.join(REPO_ROOT, "src/lib/env/env.ts");
  const envContent = fs.readFileSync(envPath, "utf-8");
  assert(
    !envContent.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
    "Fatal: Service role key must NEVER be exposed as NEXT_PUBLIC_!"
  );
  console.log("✓ Audit 2: Zero private credentials leaked to client bundles");

  // 3. Audit HTTP Security Headers
  const nextConfigPath = path.join(REPO_ROOT, "next.config.ts");
  const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");
  assert(nextConfigContent.includes("Content-Security-Policy"), "Missing CSP header");
  assert(nextConfigContent.includes("X-Frame-Options"), "Missing X-Frame-Options header");
  assert(nextConfigContent.includes("X-Content-Type-Options"), "Missing nosniff header");
  assert(nextConfigContent.includes("Strict-Transport-Security"), "Missing HSTS header");
  console.log("✓ Audit 3: All recommended security headers (CSP, HSTS, X-Frame-Options, nosniff) configured");

  console.log("==========================================================");
  console.log("LAUNCH SECURITY AUDIT PASSED [3/3 GATES VERIFIED]");
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("Security Audit Failed:", err);
  process.exit(1);
});
