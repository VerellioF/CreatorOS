# TESTING STRATEGY & QUALITY ASSURANCE PROTOCOL — CREATOROS AI

## 1. QUALITY PHILOSOPHY & OBJECTIVES

CreatorOS AI adheres to high-assurance software engineering principles:
- **No Weakened Tests:** Tests are designed to break on regressions, not softened to achieve artificial green checkmarks.
- **Tenant Isolation Verification:** Cross-tenant boundary leaks are tested with dedicated adversarial unit and integration tests.
- **Deterministic Mocking:** AI providers and third-party APIs (Midtrans, social platforms) are mocked with deterministic fixtures during automated test runs.
- **Coverage Targets:** Minimum 85% statement coverage on domain services, 100% on authorization logic and Zod validation schemas.

---

## 2. TESTING PYRAMID

```
           / \
          /   \     E2E Tests (Playwright)
         /     \    • User registration & login
        /       \   • Workspace switching & settings
       /─────────\  • Onboarding & core content journey
      /           \ 
     / Integration \ Integration Tests (Vitest)
    /     Tests     \ • Supabase RLS verification
   /                 \• Server Actions & Route Handlers
  /───────────────────\• Multi-agent state machine
 /                     \
/      Unit Tests       \ Unit Tests (Vitest)
───────────────────────── • Zod schema validation
                          • Currency, date & text utilities
                          • AI provider adapters & token counters
```

---

## 3. UNIT TESTING SPECIFICATION (VITEST)

### 3.1 Scope
- **Validation Schemas:** Ensuring invalid inputs (missing required fields, malformed emails, malicious script tags) are rejected with clear user-facing error messages.
- **Utilities:** Text formatting, duration calculations, token estimation algorithms, and currency conversions (IDR formatting).
- **Environment Validation:** Ensuring server halts if critical environment variables are absent or ill-formatted.

### 3.2 Example Validation Test Pattern
```typescript
import { describe, it, expect } from "vitest";
import { createWorkspaceSchema } from "@/features/workspace/schemas";

describe("createWorkspaceSchema", () => {
  it("rejects invalid slugs with special characters", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "My Workspace",
      slug: "invalid slug with spaces!",
      creatorMode: "creator",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid workspace payload", () => {
    const result = createWorkspaceSchema.safeParse({
      name: "Acme Creator",
      slug: "acme-creator",
      creatorMode: "affiliate",
    });
    expect(result.success).toBe(true);
  });
});
```

---

## 4. INTEGRATION & RLS TESTING

### 4.1 Row Level Security (RLS) Verification
- Spin up local Supabase test instance (`supabase start` / Docker).
- Create two distinct users: `User A` (Workspace 1) and `User B` (Workspace 2).
- Authenticate as `User B` and attempt to `SELECT`, `UPDATE`, or `DELETE` records belonging to Workspace 1.
- Assert that query returns 0 rows or raises authorization exception.

### 4.2 Server Action Authorization Verification
- Test all Server Actions with unauthenticated sessions to verify that execution throws `UnauthorizedError` and redirects to `/sign-in`.

---

## 5. END-TO-END TESTING SPECIFICATION (PLAYWRIGHT)

### 5.1 Critical Paths Tested
1. **Registration & Onboarding:**
   - User signs up with valid email/password.
   - User is redirected to onboarding/dashboard.
   - Default personal workspace is created automatically.
2. **Workspace Management:**
   - User creates a new secondary workspace.
   - User switches active workspace in the top navigation.
   - Dashboard state updates to reflect the active workspace context.
3. **Settings Persistence:**
   - User updates profile name and toggles theme preference.
   - Page refresh retains updated name and selected theme.
4. **Session Protection:**
   - Direct navigation to `/dashboard` while unauthenticated immediately redirects to `/sign-in`.

---

## 6. CONTINUOUS INTEGRATION (CI) GATES

Every commit and pull request must execute:
1. `npm run lint` (ESLint strict check — zero errors).
2. `npm run type-check` (`tsc --noEmit` — zero type errors).
3. `npm run test` (Vitest unit and integration suite).
4. `npm run build` (Next.js production build compilation).
