# CreatorOS AI — AI Content Creation Operating System

> **Transform from having no content strategy into a consistent, high-performing content creator.**

CreatorOS AI is a modular, multi-tenant AI Content Creation Operating System designed for the modern creator economy. Built with Bahasa Indonesia as its primary language and ready for global expansion, it provides tailored workflows across 4 core modes:

1. **Creator Mode:** Audience growth, niche dominance, and content consistency.
2. **Affiliate Mode:** High-converting review scripts, problem-agitate-solve formulas, and product positioning.
3. **Business Mode:** Brand authority, customer acquisition, and multi-platform promotional campaigns.
4. **Personal Brand Mode:** Thought leadership, expertise frameworks, and executive visibility.

---

## Architecture & Technology Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, React 19, Server Actions, TypeScript in strict mode)
- **Styling & Design System:** [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), Lucide Icons
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL 15+, Supabase Auth, Storage, Row Level Security)
- **Form Validation:** React Hook Form, [Zod](https://zod.dev/)
- **Background Workflows:** [Inngest](https://www.inngest.com/) durable execution engine
- **Media Processing:** Dedicated FFmpeg Media Worker
- **AI Infrastructure:** Provider-independent abstraction supporting Google Gemini, OpenAI, ElevenLabs, Runway
- **Payment Gateway:** [Midtrans](https://midtrans.com/) (QRIS, GoPay, Bank Transfer, Credit Card)
- **Error Monitoring:** [Sentry](https://sentry.io/)

---

## Project Documentation Index

All architectural specifications, database models, and governance rules are documented under `/docs` and `.agents/`:

| Document | Purpose |
| :--- | :--- |
| [`AGENTS.md`](./AGENTS.md) | Agent governance protocol, 7 non-negotiable rules, Definition of Done |
| [`docs/PRODUCT_REQUIREMENTS.md`](./docs/PRODUCT_REQUIREMENTS.md) | Comprehensive PRD across all 10 core modules |
| [`docs/SYSTEM_ARCHITECTURE.md`](./docs/SYSTEM_ARCHITECTURE.md) | Modular monolith architecture, layering, and service boundaries |
| [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | Complete normalized PostgreSQL schema with 27 entities & RLS |
| [`docs/AI_AGENT_SPECIFICATION.md`](./docs/AI_AGENT_SPECIFICATION.md) | Contracts, schemas, tools, and token limits for 10 specialized agents |
| [`docs/AI_PROVIDER_SPECIFICATION.md`](./docs/AI_PROVIDER_SPECIFICATION.md) | Provider abstraction layer, fallback strategies, and cost tracking |
| [`docs/EXTERNAL_INTEGRATIONS.md`](./docs/EXTERNAL_INTEGRATIONS.md) | Supabase, Inngest, Midtrans, Social APIs, and FFmpeg Media Worker |
| [`docs/SECURITY_ARCHITECTURE.md`](./docs/SECURITY_ARCHITECTURE.md) | Multi-tenant RLS, encryption, input validation, and audit logging |
| [`docs/UI_UX_GUIDELINES.md`](./docs/UI_UX_GUIDELINES.md) | Design tokens, typography scales, dark/light themes, and UI contracts |
| [`docs/IMPLEMENTATION_ROADMAP.md`](./docs/IMPLEMENTATION_ROADMAP.md) | Phase 1 to Phase 10 execution roadmap |
| [`docs/TESTING_STRATEGY.md`](./docs/TESTING_STRATEGY.md) | Vitest unit/integration testing, Playwright E2E, and CI gates |
| [`docs/DEPLOYMENT_GUIDE.md`](./docs/DEPLOYMENT_GUIDE.md) | Vercel, Supabase, and media worker deployment guide |
| [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) | Version history and architectural milestones |

---

## Directory Structure

```text
├── .agents/
│   └── rules/                  # Modular engineering rules
├── docs/                       # Complete architectural specifications
├── public/                     # Static assets, logos, and icons
├── src/
│   ├── app/                    # Next.js App Router (RSC & API Routes)
│   │   ├── (auth)/             # Authentication routes (Sign In, Sign Up)
│   │   ├── (dashboard)/        # Protected workspace application routes
│   │   └── api/                # Route handlers and webhooks
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── layout/             # Sidebar, Header, Shell
│   │   └── shared/             # Empty states, error boundaries, dialogs
│   ├── features/               # Feature-specific modules
│   │   ├── auth/               # Auth forms and state
│   │   ├── workspace/          # Workspace management & switching
│   │   ├── dashboard/          # Dashboard cards & onboarding checklist
│   │   └── settings/           # Profile, workspace, and account settings
│   ├── lib/
│   │   ├── supabase/           # Browser, server, and admin Supabase clients
│   │   ├── ai/                 # Unified AI provider abstraction adapters
│   │   ├── env/                # Environment variable schema validation
│   │   ├── validation/         # Shared Zod validation schemas
│   │   └── utils/              # Class merging (cn), currency, date formatters
│   ├── services/               # Typed domain business logic
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # Global TypeScript type definitions
│   └── styles/                 # Global CSS and Tailwind directives
├── supabase/
│   ├── migrations/             # Versioned SQL migrations with RLS
│   └── seed/                   # Seed data for development
└── tests/                      # Vitest and Playwright test suites
```

---

## Getting Started

### Prerequisites
- **Node.js:** v20.x or higher (Node.js LTS v26.13.0 verified)
- **npm:** v10.x or higher
- **Git**
- **Supabase Account / CLI**

### Installation
1. Clone the repository and copy the environment configuration:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in the required environment variables in `.env.local` (refer to [`.env.example`](./.env.example)).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the local development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.
