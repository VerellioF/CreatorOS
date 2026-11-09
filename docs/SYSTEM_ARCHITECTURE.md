# SYSTEM ARCHITECTURE DOCUMENT — CREATOROS AI

## 1. ARCHITECTURAL OVERVIEW & PHILOSOPHY

CreatorOS AI is designed as a **Modular Monolith** optimized for developer velocity, operational simplicity, and rigorous tenant isolation. Rather than prematurely fragmenting services into microservices, the system maintains high cohesion and low coupling through strict internal boundaries, typed service layers, and provider abstractions.

```mermaid
flowchart TD
    subgraph Client["Client Tier (Web Browser)"]
        UI["Next.js App Router (React 19 / TypeScript)"]
        Components["shadcn/ui + Tailwind CSS"]
        State["React Hook Form + Zod"]
    end

    subgraph AppLayer["Next.js Application Layer (Server)"]
        RSC["React Server Components"]
        Actions["Server Actions & Route Handlers"]
        AuthMiddleware["Auth & Session Middleware"]
        ServiceLayer["Domain Service Layer (Typed)"]
    end

    subgraph AIAbstraction["AI Provider Abstraction Layer"]
        Orchestrator["Agent Orchestrator"]
        TextAdapter["TextGenerationProvider (Gemini / OpenAI)"]
        ResearchAdapter["ResearchProvider (Perplexity / Search API)"]
        ImageAdapter["ImageGenerationProvider (Imagen / Flux / SD)"]
        VideoAdapter["VideoGenerationProvider (Runway / Luma)"]
        SpeechAdapter["SpeechGenerationProvider (ElevenLabs)"]
    end

    subgraph DataLayer["Data & Persistence Tier (Supabase)"]
        Postgres[("Supabase PostgreSQL (Multi-tenant RLS)")]
        Storage["Supabase Storage (Assets & Media)"]
        AuthService["Supabase Auth (JWT & Session)"]
    end

    subgraph AsyncTier["Background & Asynchronous Jobs"]
        Inngest["Inngest Queue & Workflow Engine"]
        MediaWorker["FFmpeg Media Worker (GPU / Dedicated)"]
    end

    subgraph ExternalServices["External APIs"]
        Midtrans["Midtrans Payment Gateway"]
        SocialPlatforms["Social Publishing APIs (TikTok, IG, YouTube)"]
    end

    UI --> RSC
    RSC --> Actions
    Actions --> AuthMiddleware
    AuthMiddleware --> ServiceLayer
    ServiceLayer --> Postgres
    ServiceLayer --> AuthService
    ServiceLayer --> Storage
    ServiceLayer --> AIAbstraction
    ServiceLayer --> Inngest
    Inngest --> MediaWorker
    Inngest --> SocialPlatforms
    ServiceLayer --> Midtrans
```

---

## 2. APPLICATION LAYERING & BOUNDARIES

### 2.1 Presentation Layer (`src/components/`, `src/app/`)
- Server Components by default for zero client bundle bloat and fast data fetching.
- Client Components (`"use client"`) strictly reserved for interactive forms, rich canvas/timeline interactions, and client-side reactive state.
- Zero direct database queries in UI components; all interactions flow through Server Actions or typed Service Layer methods.

### 2.2 Domain Service Layer (`src/services/`)
- Pure TypeScript business logic classes or modules.
- Responsible for validating domain rules, orchestrating database transactions, checking user credit quotas, and invoking AI provider abstractions.
- Every service method accepts an execution context: `{ user: UserSession, workspaceId: string }`.

### 2.3 Provider Abstraction Layer (`src/lib/ai/`)
- Employs Dependency Inversion (SOLID). Domain services interact exclusively with abstract provider interfaces.
- Concrete adapters encapsulate vendor-specific SDK quirks, schema transformations, rate-limit retry logic, and token cost calculation.
- Supported providers can be swapped dynamically or configured with automatic fallback policies.

### 2.4 Asynchronous Worker Tier (`src/inngest/` & Dedicated Worker)
- **Inngest:** Handles durable, serverless-friendly tasks (agent research workflows, long-running script generation chains, social posting retries, scheduled dispatches).
- **Media Worker:** Standalone Node/Go/Python worker with FFmpeg installed on a dedicated compute instance (or serverless GPU container) for video rendering, stitching, waveform generation, and subtitle burning.

---

## 3. MULTI-TENANCY & DATA ISOLATION ARCHITECTURE

Multi-tenancy in CreatorOS AI is rooted in the `workspaces` table:
1. Every user has a default personal workspace created upon registration.
2. Users can create or join additional workspaces (e.g., agency workspaces, team accounts).
3. Access rights are determined by `workspace_members`:
   - `owner`: Full control, billing management, workspace deletion.
   - `admin`: Member invitations, API key management, workspace settings.
   - `editor`: Create, edit, and publish content items.
   - `viewer`: Read-only access to strategy, calendars, and analytics.
4. Supabase Row Level Security (RLS) is enforced at the database engine level, ensuring that even if application-level bugs occur, PostgreSQL refuses cross-tenant data leaks.

---

## 4. ERROR HANDLING & OBSERVABILITY

1. **Structured Error Hierarchy:**
   - `AppError`: Base application error with standard error codes and HTTP status mappings.
   - `ValidationError`: Zod validation failures.
   - `AuthorizationError`: Workspace or permission rejections.
   - `ProviderError`: AI or external integration failures with retry metadata.
   - `InsufficientCreditsError`: Quota and credit exhaustion.
2. **Sentry & Centralized ErrorTracker (`src/lib/monitoring/error-tracker.ts`):** Client and server exception tracking with scrubbed PII, breadcrumbs, and severity levels.
3. **Usage & Audit Logging:** Persistent telemetry in `ai_provider_usage` and `audit_logs`.
4. **Health Probes:** `/api/health`, `/api/health/live`, `/api/health/ready` for cluster orchestration and uptime monitoring.

---

## 5. ANALYTICS INTELLIGENCE & PRODUCTION RELIABILITY

### 5.1 Analytics & Performance Tracking Architecture (`src/services/analytics-service.ts`)
- **Data Provenance:** Strict dichotomy between authenticated connected accounts (`connected_account`) and manual creator inputs (`manual_entry`).
- **Zero-Fabrication Guarantee:** Clicks and conversions return `null` if not tracked, with explicit "Belum ada data" states. No placeholder approximations or fake engagement numbers.
- **Platform Comparative Analysis:** Normalized cross-platform metrics comparing TikTok, Instagram, YouTube, Facebook, and Shopee Video.

### 5.2 AI Analyst Diagnostics Engine (`src/services/ai-analyst-service.ts`)
- **Top & Weak Content Diagnosis:** Analyzes hook retention drop-offs, emotion angles, and pacing.
- **Content Patterns & Audience Response:** Identifies formats yielding 2x+ retention and calculates viral share ratios.
- **Strategy Alignment:** Validates post composition against active Content Pillars from Phase 3 `/strategy`.
- **Traceable Recommendations:** Every actionable recommendation is backed by empirical evidence citing exact content IDs and performance deltas.

### 5.3 Automated Data Retention & Disaster Recovery
- **Retention Lifecycle:** Purges ephemeral generation jobs older than 30 days and debug publishing logs older than 90 days (`src/services/data-retention-service.ts`).
- **Backup & Restore Strategy:** Automated JSON snapshots with SHA-256 integrity checksums and tested recovery procedures (`scripts/database-backup.mjs`, `scripts/database-restore.mjs`).
