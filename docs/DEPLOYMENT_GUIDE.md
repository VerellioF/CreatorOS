# DEPLOYMENT & DEVOPS GUIDE — CREATOROS AI

## 1. INFRASTRUCTURE & HOSTING TOPOLOGY

CreatorOS AI employs modern cloud infrastructure optimized for high availability, zero cold-start database connection pooling, and distributed background workers:

```
[User Browser]
       │
       ▼
[Vercel Global Edge Network]
       │  • Next.js App Router (RSC & API Routes)
       │  • Static Asset CDN
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Supabase Cloud Platform]        [Inngest Serverless Engine]
 • PostgreSQL 15 (Supavisor)      • Durable event queues
 • Supabase Auth                  • Multi-step workflows
 • Supabase Storage (S3-compat)          │
                                         ▼
                             [Dedicated Media Worker]
                              • Docker (Node.js + FFmpeg)
                              • Railway / Fly.io / Cloud Run
```

---

## 2. ENVIRONMENT CONFIGURATION & SECRETS

### 2.1 Core Environment Matrix
```bash
# --- Web Application (Vercel) ---
NEXT_PUBLIC_APP_URL="https://creatoros.ai"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsIn..."

# --- Encryption & Security ---
ENCRYPTION_SECRET="super-secret-32-byte-hex-key-here"

# --- AI Providers ---
GEMINI_API_KEY="AIzaSy..."
OPENAI_API_KEY="sk-proj-..."
ELEVENLABS_API_KEY="el_..."
RUNWAY_API_SECRET="key_..."

# --- Background Workflows (Inngest) ---
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"

# --- Midtrans Payments ---
MIDTRANS_SERVER_KEY="SB-Mid-server-..."
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="SB-Mid-client-..."
MIDTRANS_IS_PRODUCTION="false"

# --- Error Monitoring ---
NEXT_PUBLIC_SENTRY_DSN="https://...@sentry.io/..."
```

---

## 3. SUPABASE DEPLOYMENT & MIGRATION WORKFLOW

1. **Local Development:**
   ```bash
   npx supabase init
   npx supabase start
   npx supabase migration new initial_schema
   ```
2. **Pushing Migrations to Staging / Production:**
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. **Database Connection String:**
   - Use Transaction Pooler (`port 6543`) for Next.js serverless functions to avoid Postgres connection exhaustion.
   - Use Session Pooler (`port 5432`) only for schema migrations and long-lived worker connections.

---

## 4. VERCEL PRODUCTION DEPLOYMENT

1. Connect GitHub repository to Vercel.
2. Set Build Command: `npm run build`.
3. Set Output Directory: `.next`.
4. Configure all environment variables in Vercel Project Settings.
5. Enable Vercel Web Analytics and Speed Insights.

---

## 5. DEDICATED MEDIA WORKER DEPLOYMENT (DOCKER + FFMPEG)

The media worker renders video clips, executes audio normalization, and burns dynamic subtitles:
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "dist/worker.js"]
```
Deploy the worker on Fly.io, Railway, or Google Cloud Run with minimum 2GB RAM and 2 vCPUs.

---

## 6. MONITORING, LOGGING & INCIDENT RESPONSE

- **Sentry & ErrorTracker:** Captures uncaught client and server exceptions with sourcemap tracking and PII scrubbing (`src/lib/monitoring/error-tracker.ts`).
- **Supabase Dashboard:** Monitors database query performance, index utilization, and connection pool saturation.
- **Inngest Dashboard:** Inspects running and failed agent workflows with instant replay capabilities.

---

## 7. HEALTH PROBES & PRODUCTION READINESS CHECKLIST

- **Liveness Probe:** `GET /api/health/live` (Returns HTTP 200 `{ status: "live" }`).
- **Readiness Probe:** `GET /api/health/ready` (Returns HTTP 200 `{ status: "ready" }` if database pool is responsive, or HTTP 503 if unreachable).
- **Comprehensive Diagnostic Probe:** `GET /api/health` (Reports uptime, memory consumption, Node.js version, and database round-trip latency).

### Pre-Launch Gate Checklist:
1. [x] 100% RLS enabled on all 39 PostgreSQL tables (`node scripts/run-security-audit.mjs`).
2. [x] Zero service-role or private API keys exposed to frontend bundles (`NEXT_PUBLIC_*`).
3. [x] HTTP Security Headers active (`Content-Security-Policy`, `HSTS`, `X-Frame-Options: DENY`, `nosniff`).
4. [x] Load Benchmark passes 100 concurrent requests with p95 latency < 250ms (`node scripts/load-test.mjs`).
5. [x] Production build passes cleanly with 0 TypeScript/ESLint errors (`npm run build`).

---

## 8. AUTOMATED BACKUP, DISASTER RECOVERY & DATA RETENTION SCHEDULE

### Automated Database Backup & Verification:
- **Backup Script:** `node scripts/database-backup.mjs`
  - Exports database snapshot to `backups/creatoros_backup_<timestamp>.json`.
  - Calculates and embeds SHA-256 integrity checksum.
- **Restore & Verification Script:** `node scripts/database-restore.mjs [path]`
  - Validates checksum match before permitting restoration to prevent corrupted data ingestion.
- **Recommended Schedule:** Run daily via GitHub Actions or cloud cron at 02:00 UTC.

### Automated Data Retention Schedule:
- **Execution Script:** `src/services/data-retention-service.ts` or database stored procedure `execute_data_retention_cleanup`.
- **Retention Policies:**
  - Ephemeral Generation Jobs: 30 days retention.
  - Debug & Publishing Logs: 90 days retention.
  - Audit & Financial Logs: 7 years (statutory compliance).
