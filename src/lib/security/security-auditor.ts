import fs from "node:fs";
import path from "node:path";

export interface MigrationAuditResult {
  totalTables: number;
  unprotectedTables: string[];
  protectedTables: string[];
  passed: boolean;
}

export interface EnvironmentAuditResult {
  leakedSecrets: string[];
  safeVariables: string[];
  passed: boolean;
}

export interface SecurityHeadersAuditResult {
  hasCSP: boolean;
  hasHSTS: boolean;
  hasXContentTypeOptions: boolean;
  hasXFrameOptions: boolean;
  hasReferrerPolicy: boolean;
  missingHeaders: string[];
  passed: boolean;
}

export class SecurityAuditor {
  /**
   * Scans all SQL migrations in supabase/migrations and checks RLS enablement on all declared tables
   */
  static auditDatabaseMigrations(migrationsDir?: string): MigrationAuditResult {
    const dir = migrationsDir || path.resolve(process.cwd(), "supabase/migrations");
    if (!fs.existsSync(dir)) {
      throw new Error(`Migrations directory not found: ${dir}`);
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
    const createdTables = new Set<string>();
    const rlsEnabledTables = new Set<string>();

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");

      // Match CREATE TABLE [IF NOT EXISTS] public.<table_name>
      const createTableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.([a-zA-Z0-9_]+)/gi;
      let match: RegExpExecArray | null;
      while ((match = createTableRegex.exec(content)) !== null) {
        createdTables.add(match[1]);
      }

      // Match ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY
      const enableRlsRegex = /ALTER\s+TABLE\s+public\.([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
      while ((match = enableRlsRegex.exec(content)) !== null) {
        rlsEnabledTables.add(match[1]);
      }
    }

    const unprotectedTables: string[] = [];
    const protectedTables: string[] = [];

    for (const table of Array.from(createdTables)) {
      if (rlsEnabledTables.has(table)) {
        protectedTables.push(table);
      } else {
        unprotectedTables.push(table);
      }
    }

    return {
      totalTables: createdTables.size,
      unprotectedTables,
      protectedTables,
      passed: unprotectedTables.length === 0,
    };
  }

  /**
   * Audits process.env and codebase files to ensure no private keys or service role tokens are prefixed with NEXT_PUBLIC_
   */
  static auditEnvironmentVariables(): EnvironmentAuditResult {
    const leakedSecrets: string[] = [];
    const safeVariables: string[] = [];

    const dangerousPatterns = [
      "SERVICE_ROLE",
      "SECRET",
      "PRIVATE_KEY",
      "API_KEY_SECRET",
      "SERVER_KEY",
      "MIDTRANS_SERVER_KEY",
    ];

    // Check process.env
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("NEXT_PUBLIC_")) {
        for (const pattern of dangerousPatterns) {
          if (key.toUpperCase().includes(pattern)) {
            leakedSecrets.push(`Environment variable ${key} leaks sensitive credential pattern '${pattern}' to client bundle`);
          }
        }
        if (!dangerousPatterns.some((p) => key.toUpperCase().includes(p))) {
          safeVariables.push(key);
        }
      }
    }

    // Check env.ts definition
    const envPath = path.resolve(process.cwd(), "src/lib/env/env.ts");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      if (content.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) {
        leakedSecrets.push("env.ts references NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
      }
    }

    return {
      leakedSecrets,
      safeVariables,
      passed: leakedSecrets.length === 0,
    };
  }

  /**
   * Validates next.config.ts for critical security headers
   */
  static auditSecurityHeaders(nextConfigPath?: string): SecurityHeadersAuditResult {
    const file = nextConfigPath || path.resolve(process.cwd(), "next.config.ts");
    if (!fs.existsSync(file)) {
      throw new Error(`next.config.ts not found at ${file}`);
    }

    const content = fs.readFileSync(file, "utf-8");

    const hasCSP = content.includes("Content-Security-Policy");
    const hasHSTS = content.includes("Strict-Transport-Security");
    const hasXContentTypeOptions = content.includes("X-Content-Type-Options") && content.includes("nosniff");
    const hasXFrameOptions = content.includes("X-Frame-Options") && content.includes("DENY");
    const hasReferrerPolicy = content.includes("Referrer-Policy");

    const missingHeaders: string[] = [];
    if (!hasCSP) missingHeaders.push("Content-Security-Policy");
    if (!hasHSTS) missingHeaders.push("Strict-Transport-Security");
    if (!hasXContentTypeOptions) missingHeaders.push("X-Content-Type-Options");
    if (!hasXFrameOptions) missingHeaders.push("X-Frame-Options");
    if (!hasReferrerPolicy) missingHeaders.push("Referrer-Policy");

    return {
      hasCSP,
      hasHSTS,
      hasXContentTypeOptions,
      hasXFrameOptions,
      hasReferrerPolicy,
      missingHeaders,
      passed: missingHeaders.length === 0,
    };
  }
}
