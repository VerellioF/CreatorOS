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

- **Sentry:** Captures uncaught client and server exceptions with sourcemap tracking.
- **Supabase Dashboard:** Monitors database query performance, index utilization, and connection pool saturation.
- **Inngest Dashboard:** Inspects running and failed agent workflows with instant replay capabilities.
