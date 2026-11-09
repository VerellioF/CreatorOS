# Phase 6: Publishing Center & SaaS Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade multi-platform Publishing Center (TikTok, Instagram, YouTube, Facebook, Shopee Video manual fallback), Midtrans payment gateway integration, SaaS subscription management (Free, Creator, Pro, Business with dynamic admin config), atomic credit ledger with idempotency and refunds, and a comprehensive superadmin dashboard.

**Architecture:** A modular SaaS engine comprising: (1) typed platform publishing adapters declaring genuine API capabilities and official authorization/posting flows with confirmed-status guarantees and rich manual export fallbacks; (2) official Midtrans Snap and Webhook integration with SHA-512 cryptographic verification and server-only subscription activation; (3) atomic PostgreSQL stored procedures with row-level locks and idempotency keys managing credits, deductions, and refunds; (4) a centralized superadmin dashboard for workspace, user, subscription, credit, AI telemetry, and provider management; and (5) 100% RLS tenant isolation across all tables.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict mode), PostgreSQL 18.4 + Supabase RLS, Node.js `node:crypto`, Midtrans Snap & Webhook APIs, Zod, Tailwind CSS, Lucide icons, Vitest.

**Spec:** Phase 6 Requirements from User Request & `docs/PRODUCT_REQUIREMENTS.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`.

## Global Constraints

- TypeScript in `strict` mode with zero unescaped `any` types.
- All database tables must have 100% Row Level Security (RLS) isolating rows by verified `workspace_id`.
- Zero service-role keys leaked to client bundles (`process.env.NEXT_PUBLIC_*`).
- Never activate subscriptions based solely on frontend redirects; activation requires verified server webhook or server-to-server status check.
- Never use unauthorized scraping or unofficial publishing APIs; each adapter must declare its authentic capabilities.
- Never mark content as published until the platform confirms it (or creator confirms manual export).
- Prevent duplicate credit deductions using strict idempotency keys and row-level locking (`FOR UPDATE`).
- All existing 20 test files and 108 tests must remain green.

## Review Focus

1. **Midtrans Webhook Spoofing Prevention:** Malicious actors sending spoofed webhook notifications with fake settlement statuses; the system must verify the SHA-512 hash `hash(order_id + status_code + gross_amount + ServerKey)` and reject invalid signatures with HTTP 401.
2. **Double-Deduction & Race Conditions:** Concurrent requests deducting credits for media jobs; atomic procedures with Level 4 `credit_wallets FOR UPDATE` and unique `idempotency_key` in `credit_transactions` must prevent double-spending.
3. **Premature Publishing Confirmation:** Marking video posts as published immediately upon submitting upload payload; the system must keep status in `publishing` until the platform API confirms `PUBLISH_COMPLETE` / `FINISHED`, or provide clear error states.
4. **Shopee Video & Manual Export Fallback:** Handling platforms without public creator publishing APIs; the system must transparently declare `can_publish_directly: false` and provide a step-by-step export bundle with download links, formatted captions, and confirmation triggers.
5. **Admin Route Authorization Bypass:** Unauthorized workspace members accessing `/admin` routes; the server must strictly verify `is_superadmin` in the user's profile and deny non-superadmins.

---

### Task 1: Database Migration for Phase 6 Schema, Stored Procedures & RLS

**Files:**
- Create: `supabase/migrations/20261031050000_phase6_publishing_and_saas_monetization.sql`
- Modify: `src/lib/supabase/types.ts`
- Create: `supabase/tests/run_phase6_postgres_audit.mjs`
- Test: `tests/integration/phase6-database-schema.test.ts`

**Interfaces:**
- Consumes: `public.workspaces`, `public.profiles`, `public.credit_wallets`, `public.content_items`, `public.media_assets`
- Produces: Tables `public.saas_plans`, `public.subscriptions`, `public.payment_transactions`, `public.social_accounts`, `public.publishing_jobs`, `public.publishing_logs`, `public.system_settings`.
- Stored Procedures: `deduct_workspace_credits`, `refund_workspace_credits`, `allocate_workspace_credits`, `activate_subscription_payment`, `is_superadmin`.

- [ ] **Step 1: Write failing test for Phase 6 schema, constraints, stored procedures, and RLS policies**
- [ ] **Step 2: Run test to confirm it fails before migration is applied**
- [ ] **Step 3: Implement `supabase/migrations/20261031050000_phase6_publishing_and_saas_monetization.sql` with tables, indexes, triggers, stored procedures, seed data, and 100% RLS policies**
- [ ] **Step 4: Create and execute `supabase/tests/run_phase6_postgres_audit.mjs`**
- [ ] **Step 5: Update TypeScript types in `src/lib/supabase/types.ts`**
- [ ] **Step 6: Run test to confirm it passes**

---

### Task 2: Platform Publishing Adapters & Capability Registry

**Files:**
- Create: `src/lib/publishing/types.ts`
- Create: `src/lib/publishing/base-adapter.ts`
- Create: `src/lib/publishing/adapters/tiktok-adapter.ts`
- Create: `src/lib/publishing/adapters/instagram-adapter.ts`
- Create: `src/lib/publishing/adapters/youtube-adapter.ts`
- Create: `src/lib/publishing/adapters/facebook-adapter.ts`
- Create: `src/lib/publishing/adapters/shopee-adapter.ts`
- Create: `src/lib/publishing/adapter-registry.ts`
- Test: `tests/unit/phase6-publishing-adapters.test.ts`

**Interfaces:**
- Platform adapters declare `PlatformCapabilities`: `canUpload`, `canSchedule`, `canPublishDirectly`, `supportsReelsShorts`, `requiresManualFallback`, `maxVideoDurationSec`, `supportedMediaTypes`.
- Methods: `connectAccount()`, `disconnectAccount()`, `uploadMedia()`, `schedulePost()`, `publishPost()`, `generateManualExportFallback()`, `checkPublishStatus()`.

- [ ] **Step 1: Write failing test for publishing adapters and capability registry**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Implement `types.ts`, `base-adapter.ts`, and 5 platform adapters (`TikTok`, `Instagram`, `YouTube`, `Facebook`, `ShopeeVideo`)**
- [ ] **Step 4: Implement `adapter-registry.ts`**
- [ ] **Step 5: Run tests to verify all adapters adhere to capability contracts, validation, and confirmed status**

---

### Task 3: Publishing Service & Workflows

**Files:**
- Create: `src/services/publishing-service.ts`
- Create: `src/app/api/workspace/publishing/route.ts`
- Create: `src/app/api/workspace/publishing/[id]/route.ts`
- Test: `tests/integration/phase6-publishing-workflows.test.ts`

**Interfaces:**
- Connect/disconnect social accounts with encrypted credentials.
- Schedule, dispatch, confirm publishing status with audit logs in `publishing_logs`.
- Manual fallback package generation with checklist and confirmation endpoint.
- Automatic credit refund trigger upon platform publishing failure.

- [ ] **Step 1: Write failing integration test for publishing workflows (connect, schedule, manual fallback, logs, refunds)**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Implement `PublishingService` with database persistence, audit logging, and manual fallback**
- [ ] **Step 4: Implement API routes for publishing operations**
- [ ] **Step 5: Run tests to verify all tests pass**

---

### Task 4: Credit Management System with Atomic Operations & Idempotency

**Files:**
- Create: `src/services/credit-service.ts`
- Modify: `src/services/usage-billing-service.ts`
- Test: `tests/unit/phase6-credit-system.test.ts`

**Interfaces:**
- `deductCredits(params)`: atomic deduction with idempotency key, prevents double-spending.
- `refundCredits(params)`: refunds credits for eligible failed operations.
- `allocateCredits(params)`: grants subscription credits or admin top-ups.
- `enforceLimits(params)`: checks workspace & user limits.
- `getCreditHistory(workspaceId)`: transaction ledger with full attribution.

- [ ] **Step 1: Write failing unit test for credit operations (atomic deduction, idempotency, refund, limits)**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Implement `CreditService` and update `UsageBillingService`**
- [ ] **Step 4: Run tests to verify idempotency and balance integrity**

---

### Task 5: Midtrans Payment Gateway & SaaS Billing Engine

**Files:**
- Create: `src/lib/billing/midtrans-client.ts`
- Create: `src/services/billing-service.ts`
- Create: `src/app/api/webhooks/midtrans/route.ts`
- Create: `src/app/api/billing/checkout/route.ts`
- Test: `tests/unit/phase6-midtrans-billing.test.ts`
- Test: `tests/integration/phase6-billing-webhooks.test.ts`

**Interfaces:**
- Midtrans Snap API transaction creation.
- Webhook signature verification (SHA-512 `order_id + status_code + gross_amount + serverKey`).
- Subscription lifecycle management: 30-day period activation, plan credit allocation, expiration check.
- Rejection of frontend-only activation; payment history tracking.

- [ ] **Step 1: Write failing tests for Midtrans signature verification, webhook processing, and subscription activation**
- [ ] **Step 2: Run tests to confirm failure**
- [ ] **Step 3: Implement `MidtransClient`, `BillingService`, checkout route, and webhook endpoint**
- [ ] **Step 4: Run tests to verify secure webhook handling and subscription activation**

---

### Task 6: Superadmin Service & System Configuration

**Files:**
- Create: `src/services/admin-service.ts`
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/workspaces/route.ts`
- Create: `src/app/api/admin/plans/route.ts`
- Create: `src/app/api/admin/health/route.ts`
- Test: `tests/unit/phase6-admin-service.test.ts`

**Interfaces:**
- Superadmin authorization guard.
- User and workspace management (status, credit adjustments).
- SaaS plan pricing & limits dynamic configuration (Free, Creator, Pro, Business).
- AI usage aggregation & provider configurations.
- System health diagnostic probes.

- [ ] **Step 1: Write failing test for admin service (authorization, plan configuration, credit adjustment, system health)**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Implement `AdminService` and admin API endpoints**
- [ ] **Step 4: Run tests to verify superadmin security and configuration updates**

---

### Task 7: UI Implementation: Publishing Center, SaaS Billing & Admin Dashboard

**Files:**
- Create: `src/features/publishing/components/social-accounts-manager.tsx`
- Create: `src/features/publishing/components/publish-composer.tsx`
- Create: `src/features/publishing/components/manual-export-dialog.tsx`
- Create: `src/features/publishing/components/publishing-history-list.tsx`
- Create: `src/app/(dashboard)/publish/page.tsx`
- Create: `src/features/billing/components/subscription-plans-card.tsx`
- Create: `src/features/billing/components/payment-history-table.tsx`
- Create: `src/app/(dashboard)/settings/billing/page.tsx`
- Create: `src/features/admin/components/admin-overview.tsx`
- Create: `src/features/admin/components/plan-config-editor.tsx`
- Create: `src/features/admin/components/user-management-table.tsx`
- Create: `src/features/admin/components/workspace-management-table.tsx`
- Create: `src/features/admin/components/ai-telemetry-monitor.tsx`
- Create: `src/features/admin/components/system-health-panel.tsx`
- Create: `src/app/(dashboard)/admin/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Test: `tests/unit/phase6-ui-components.test.tsx`

**Interfaces:**
- Responsive modern SaaS UI adhering to `UI_UX_GUIDELINES.md` (Linear/Raycast aesthetic, zero fake functionality).
- Accessible controls, loading states, error states, and toast notifications.

- [ ] **Step 1: Write UI component tests**
- [ ] **Step 2: Implement Publishing Center components and `/publish` page**
- [ ] **Step 3: Implement Billing & Subscription components and `/settings/billing` page**
- [ ] **Step 4: Implement Admin Dashboard components and `/admin` page**
- [ ] **Step 5: Update `Sidebar` navigation links**
- [ ] **Step 6: Run UI tests to verify rendering and interaction**

---

### Task 8: Verification, Documentation & Definition of Done

**Files:**
- Modify: `docs/DATABASE_SCHEMA.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/IMPLEMENTATION_ROADMAP.md`

- [ ] **Step 1: Run complete test suite (`npm.cmd test`)**
- [ ] **Step 2: Run TypeScript type-check (`npm.cmd run type-check`)**
- [ ] **Step 3: Run full static and PostgreSQL audit (`node supabase/tests/run_phase6_postgres_audit.mjs`)**
- [ ] **Step 4: Synchronize documentation and update CHANGELOG**
- [ ] **Step 5: Issue Phase 6 Definition of Done evaluation report**
