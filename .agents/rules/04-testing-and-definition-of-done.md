# 04 - Testing Strategy & Definition of Done

## 1. Test Pyramid
1. **Unit Tests (Vitest):**
   - Core utility functions (`formatCurrency`, `slugify`).
   - Domain business logic & calculation services.
   - Zod validation schemas.
   - Provider adapters and mock transformations.
2. **Integration Tests (Vitest):**
   - Supabase RLS verification (testing that User A cannot query User B's workspace).
   - Server Actions and Route Handlers with authenticated test sessions.
   - Multi-agent orchestrator state transitions.
3. **End-to-End Tests (Playwright):**
   - User onboarding journey (Sign up -> Workspace creation -> Dashboard).
   - Core creator flows (Niche discovery -> Idea generation -> Script generation).
   - Settings & theme toggling.

## 2. Phase Gate Verification Requirements
Before closing any phase:
- Codebase must pass `npm run lint` with 0 warnings or errors.
- Codebase must pass `tsc --noEmit` with 0 type errors.
- All unit & integration tests must pass.
- Documentation in `/docs` must match implemented code.
- Provide a structured completion report with:
  1. Implemented features.
  2. Changed files.
  3. Database changes.
  4. Tests executed and results.
  5. Security checks.
  6. Known limitations & blockers.
  7. Acceptance criteria checklist.
  8. Explicit Status: **PASS** or **FAIL**.
