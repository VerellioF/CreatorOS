# Phase 5: AI Agent Ecosystem & Workflow Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the coordinated multi-agent ecosystem featuring 10 specialized agents, an Orchestrator state machine, human approval checkpoints, durable state persistence, automated scheduling, and credit metering.

**Architecture:** A modular state-machine workflow engine that coordinates 10 typed agents with explicit Zod contracts, transactional PostgreSQL persistence (`workflow_runs`, `workflow_steps`, `workflow_schedules`, `workflow_logs`) with 100% RLS tenant isolation, human-in-the-loop pause/resume/approval gates, robust crash-recovery and retry policies, and an interactive UI in `/agents`.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict mode), PostgreSQL 18.4 + Supabase RLS, Zod, Tailwind CSS, Lucide icons, Vitest.

**Spec:** [docs/AI_AGENT_SPECIFICATION.md](file:///d:/CreatorOS%20AI/docs/AI_AGENT_SPECIFICATION.md)

## Global Constraints

- TypeScript in `strict` mode with zero unescaped `any` types.
- All database tables must have 100% Row Level Security (RLS) isolating rows by verified `workspace_id`.
- Zero service-role keys leaked to the client bundle (`process.env.NEXT_PUBLIC_*`).
- Every LLM interaction must be validated against a strict Zod schema before database ingestion.
- Enforce hard execution caps (max 5 turns per task, execution timeout budgets) to prevent runaway autonomous loops.
- All AI usage and credit deductions must route through `public.record_ai_usage_and_deduct_credits()` with pre-flight balance checks.
- All existing 14 test suites and 71 tests must remain green.

## Review Focus

1. **Crash & Interruption Recovery:** Server reboots mid-step leave running jobs dangling; the engine must detect orphaned running steps on startup and safely resume or mark them retryable.
2. **Credit Exhaustion Mid-Workflow:** When a workspace runs out of credits halfway through a 5-step workflow, the engine must pause gracefully without corrupting completed step outputs.
3. **Human Approval State Integrity:** When a workflow enters `waiting_approval`, execution must halt completely until a valid workspace member submits an approval or rejection.
4. **Retry & Timeout Safety:** Agent timeouts must be handled cleanly via abort signals with exponential backoff retries without double-deducting credits.
5. **Context Carry-Forward:** Output payloads from upstream agents (e.g., Researcher output) must reliably pass into downstream agents (e.g., Strategist input) without loss of typed fields.

---

### Task 1: Database Migration for Workflow State & Schedules

**Files:**
- Create: `supabase/migrations/20261031040000_phase5_ai_agents_and_automation.sql`
- Modify: `src/lib/supabase/types.ts`
- Test: `tests/integration/phase5-database-schema.test.ts`

**Interfaces:**
- Consumes: `public.workspaces`, `public.workspace_members`, `public.credit_wallets`
- Produces: Tables `public.workflow_runs`, `public.workflow_steps`, `public.workflow_schedules`, `public.workflow_logs`, and RPCs `public.advance_workflow_step`, `public.approve_workflow_step`

- [ ] **Step 1: Write the failing test for schema migration and RLS isolation**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement PostgreSQL migration with 4 tables, RLS policies, indexes, and atomic RPCs**
- [ ] **Step 4: Update TypeScript definitions in `src/lib/supabase/types.ts`**
- [ ] **Step 5: Run test to verify it passes**
- [ ] **Step 6: Commit changes**

---

### Task 2: Agent Schemas & Type Contracts

**Files:**
- Create: `src/lib/validation/agent-schemas.ts`
- Create: `src/lib/ai/schemas/agent-json-schemas.ts`
- Test: `tests/unit/phase5-agent-schemas.test.ts`

**Interfaces:**
- Consumes: `src/lib/ai/types.ts`
- Produces: Zod schemas and TypeScript types for all 10 agents (input, output, options, status, logs)

- [ ] **Step 1: Write failing unit tests for agent schemas**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Zod schemas and JSON schemas for all 10 agents**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit changes**

---

### Task 3: Base Agent Runner & Specialized Agent Implementations

**Files:**
- Create: `src/lib/ai/agents/base-agent.ts`
- Create: `src/lib/ai/agents/orchestrator-agent.ts`
- Create: `src/lib/ai/agents/researcher-agent.ts`
- Create: `src/lib/ai/agents/strategist-agent.ts`
- Create: `src/lib/ai/agents/idea-generator-agent.ts`
- Create: `src/lib/ai/agents/scriptwriter-agent.ts`
- Create: `src/lib/ai/agents/storyboard-agent.ts`
- Create: `src/lib/ai/agents/designer-agent.ts`
- Create: `src/lib/ai/agents/producer-agent.ts`
- Create: `src/lib/ai/agents/analyst-agent.ts`
- Create: `src/lib/ai/agents/monetization-coach-agent.ts`
- Create: `src/lib/ai/agents/index.ts`
- Test: `tests/unit/phase5-agents.test.ts`

**Interfaces:**
- Consumes: `src/lib/ai/provider-registry.ts`, `src/services/creator-context-service.ts`, `src/services/usage-billing-service.ts`
- Produces: Concrete agent classes implementing `execute(input, context)` with timeout, retry, logging, and credit tracking

- [ ] **Step 1: Write failing unit tests for agent execution, retries, and timeouts**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `BaseAgent` and the 10 specialized agent classes**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit changes**

---

### Task 4: Workflow Orchestration Engine (Workflows A, B, C & Human Approval)

**Files:**
- Create: `src/services/workflow-orchestrator-service.ts`
- Test: `tests/integration/phase5-workflow-orchestration.test.ts`

**Interfaces:**
- Consumes: All 10 agents, `src/lib/supabase/server.ts`, `src/services/usage-billing-service.ts`
- Produces: Methods `startWorkflow`, `executeNextStep`, `approveStep`, `pauseWorkflow`, `resumeWorkflow`, `cancelWorkflow`, `retryStep`, `recoverInterruptedJobs`

- [ ] **Step 1: Write failing integration tests for Workflows A, B, and C with human approval checkpoints**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `WorkflowOrchestratorService` with durable state transitions and recovery**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit changes**

---

### Task 5: Automation & Scheduling Service

**Files:**
- Create: `src/services/workflow-automation-service.ts`
- Create: `src/app/api/workspace/workflows/route.ts`
- Create: `src/app/api/workspace/workflows/[id]/route.ts`
- Test: `tests/unit/phase5-automation.test.ts`

**Interfaces:**
- Consumes: `WorkflowOrchestratorService`, `src/lib/supabase/server.ts`
- Produces: Automation triggers, recurring cron dispatchers, execution caps (max 5 turns)

- [ ] **Step 1: Write failing tests for workflow scheduling and automation**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `WorkflowAutomationService` and workflow API route handlers**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit changes**

---

### Task 6: Server Actions & Interactive Agent Workspace UI

**Files:**
- Create: `src/features/agents/actions.ts`
- Create: `src/features/agents/components/workflow-launcher-card.tsx`
- Create: `src/features/agents/components/workflow-timeline-view.tsx`
- Create: `src/features/agents/components/human-approval-dialog.tsx`
- Create: `src/features/agents/components/agent-log-viewer.tsx`
- Create: `src/features/agents/components/workflow-schedules-list.tsx`
- Create: `src/features/agents/components/agent-workspace-view.tsx`
- Create: `src/app/(dashboard)/agents/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Test: `tests/unit/phase5-agent-ui.test.tsx`

**Interfaces:**
- Consumes: `WorkflowOrchestratorService`, `WorkflowAutomationService`, UI primitives
- Produces: Interactive `/agents` dashboard with live execution, step inspection, approval dialog, and log viewer

- [ ] **Step 1: Write failing component tests for Agent Workspace and Approval Dialog**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement Server Actions and React components for `/agents`**
- [ ] **Step 4: Wire `/agents` into Sidebar navigation**
- [ ] **Step 5: Run test to verify it passes**
- [ ] **Step 6: Commit changes**

---

### Task 7: Full System Verification, Audit & Documentation Sync

**Files:**
- Create: `supabase/tests/run_phase5_postgres_audit.mjs`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/DATABASE_SCHEMA.md`
- Modify: `docs/IMPLEMENTATION_ROADMAP.md`

- [ ] **Step 1: Run comprehensive PostgreSQL multi-tenant security and RLS audit**
- [ ] **Step 2: Run full test suite (`npm run test`) and type check (`npm run type-check`)**
- [ ] **Step 3: Update documentation and changelog**
- [ ] **Step 4: Commit changes**
