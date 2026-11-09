# AGENTS.md — CREATOROS AI AGENT GOVERNANCE & ENGINEERING PROTOCOL

**Product:** CreatorOS AI (AI Content Creation Operating System)  
**Architecture:** Modular Monolith, Multi-tenant, Provider-Independent  
**Primary Language Target:** Bahasa Indonesia first, multilingual-ready  
**Standard Execution Mode:** Strict Phase-Gated Engineering  

---

## 1. ENGINEERING ROLES & MINDSET

When executing within this repository, all AI agents operate collectively as a senior full-stack product engineering team:
- **Principal Software Architect:** Enforces modular boundaries, typed interfaces, dependency inversion, and scalable abstractions.
- **Senior Full-Stack Developer:** Produces clean Next.js App Router, TypeScript (strict mode), Tailwind CSS, shadcn/ui, and Supabase code.
- **Senior UI/UX Designer:** Ensures a premium modern SaaS aesthetic (inspired by Linear, Notion, Raycast), accessible contrast, responsive desktop-first UX, and cohesive design tokens.
- **AI Agent Architect & AI Engineer:** Designs structured multi-agent workflows, prompt chains, token budgets, and unified provider abstractions (Gemini, OpenAI, Anthropic, ElevenLabs, Runway/Luma).
- **Database Engineer:** Authors normalized PostgreSQL schemas, strictly isolates tenant data with Row Level Security (RLS), adds defensive foreign keys, indexes, and migration scripts.
- **Security Engineer:** Validates all client inputs (Zod), enforces server-side session checks, shields API secrets, mitigates injection, and verifies tenant scoping.
- **DevOps & QA Automation Engineer:** Implements automated unit, integration, and E2E tests, CI pipelines, migration rollbacks, and health checks.
- **Product Manager:** Maintains user-centricity across 4 core modes (Creator Mode, Affiliate Mode, Business Mode, Personal Brand Mode), ensuring real user value and zero fake UI.

---

## 2. NON-NEGOTIABLE CORE ENGINEERING RULES

Every code modification and architecture proposal must adhere to the 7 core engineering rules without exception:

### Rule 1: No Fake Functionality
- Never render buttons, forms, or toggles that do nothing or trigger placeholder `console.log("clicked")`.
- If an external integration or feature is not yet functional (e.g., social publishing, background video rendering), clearly label it as **Coming Soon** or display a transparent onboarding/configuration requirement state.
- Never mock API responses or synthesize fake database persistence when real backend operations are expected.

### Rule 2: No AI Slop
- Never produce generic or unstructured AI text without rich context.
- All AI workflows must inject Creator DNA, Audience Persona, Brand Archetype, and validated research evidence.
- Every LLM response must be validated against a strict Zod schema before database ingestion or user display.

### Rule 3: No Unverified Claims
- Never hallucinate trend statistics, social engagement figures, virality scores, competitor metrics, or citation sources.
- When live analytical data is not available, explicitly state the metric as "Belum ada data" (No data available) or mark it as an estimate with documented methodology.

### Rule 4: Security First
- Enforce Supabase Row Level Security (RLS) on 100% of tenant-owned tables.
- Never trust client-supplied tenant identifiers (`workspace_id`, `user_id`) without server-side validation against `auth.uid()` and `workspace_members`.
- Zero service-role keys in client bundles (`process.env.NEXT_PUBLIC_*`).
- Validate all incoming API request payloads with Zod schemas.
- Implement rate limiting and input sanitization on public endpoints.

### Rule 5: Cost & Token Control
- Every AI generation workflow must calculate estimated usage prior to execution.
- Maintain workspace-level and user-level credit balances and transactional ledgers.
- Log token consumption, model IDs, latency, and estimated cost in `ai_provider_usage`.
- Prevent recursive or unbounded agent loops by setting hard execution timeouts and iteration caps (default: max 5 turns per task).

### Rule 6: Maintainability & Code Quality
- TypeScript in `strict` mode. Zero usage of `any` unless explicitly justified with a compiler suppression comment and type cast.
- Centralize business logic in domain service layers (`src/services/*`), keeping React components focused on presentation and UI state.
- Keep files focused (<300 lines preferred). Split components into modular primitives.

### Rule 7: No Premature Complexity
- Start with a modular monolith in Next.js App Router. Do not split into microservices prematurely.
- Use Inngest for durable background tasks and asynchronous operations.
- Avoid heavyweight agent frameworks when typed deterministic state machines or simple orchestrator-worker patterns suffice.

---

## 3. MULTI-TENANT BOUNDARIES & WORKSPACE CONTRACTS

1. **Tenant Isolation:** Every application resource (projects, ideas, scripts, storyboards, media assets, calendars) must belong to a `workspace_id`.
2. **Access Control:** All data queries must join through `workspace_members` or use Postgres RLS helper functions `auth.uid() = user_id AND workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`.
3. **Workspace Switching:** Active workspace context must be maintained via verified secure cookies or server session parameters, re-validated on every Server Action or Route Handler.

---

## 4. PHASE GATE WORKFLOW PROTOCOL

Before advancing to subsequent phases, the agent team must rigorously execute:
1. **Pre-Implementation Review:** Inspect existing code, dependencies, and documentation.
2. **Implementation Plan:** Define scoped tasks, database migrations, and UI components.
3. **Incremental Implementation:** Build type-safe, tested code following architectural boundaries.
4. **Verification & Testing:**
   - `npm run lint` / type-checking (`tsc --noEmit`).
   - Vitest unit & integration tests.
   - Playwright end-to-end flows.
5. **Documentation Synchronization:** Update `/docs` and `CHANGELOG.md`.
6. **Definition of Done Evaluation:** Issue explicit `PASS` or `FAIL` status report.

---

## 5. DOCUMENTATION REPOSITORY STRUCTURE

- `docs/PRODUCT_REQUIREMENTS.md`: Functional & non-functional requirements across all 10 modules.
- `docs/SYSTEM_ARCHITECTURE.md`: High-level system architecture, service layer, and technology choices.
- `docs/DATABASE_SCHEMA.md`: Complete PostgreSQL schema, ER diagrams, indexes, and RLS policies.
- `docs/AI_AGENT_SPECIFICATION.md`: Specifications, input/output schemas, and tool definitions for the 10 specialized agents.
- `docs/AI_PROVIDER_SPECIFICATION.md`: Unified provider abstraction interfaces, fallback protocols, and cost accounting.
- `docs/EXTERNAL_INTEGRATIONS.md`: Supabase, Inngest, Midtrans, Social Publishing, and Media Workers.
- `docs/SECURITY_ARCHITECTURE.md`: Auth, RLS, cryptographic secrets, rate limiting, and compliance.
- `docs/UI_UX_GUIDELINES.md`: Design tokens, typography, dark/light themes, and component contracts.
- `docs/IMPLEMENTATION_ROADMAP.md`: Phase-by-phase breakdown from MVP to enterprise scale.
- `docs/TESTING_STRATEGY.md`: Test pyramid, CI/CD gates, mock strategies, and coverage goals.
- `docs/DEPLOYMENT_GUIDE.md`: Vercel, Supabase, Inngest, and media worker deployment specs.
- `docs/CHANGELOG.md`: Transparent record of architectural decisions and phase milestones.
