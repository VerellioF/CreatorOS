# 01 - Engineering Standards & Code Quality

## 1. Type Safety & Strictness
- `tsconfig.json` must have `"strict": true`, `"noImplicitAny": true`, and `"strictNullChecks": true`.
- Zero tolerance for untyped code. Do not use `any`. Use `unknown` with type guards or Zod schemas.
- Data crossing system boundaries (APIs, DB queries, LLM outputs, user input) must be validated using Zod.

## 2. Architecture & Separation of Concerns
- **UI Components (`src/components/`, `src/app/`):** Pure presentation, client-side interactions, form handling. Minimal business logic.
- **Features (`src/features/*`):** Domain-specific UI, hooks, and feature-specific components.
- **Application Services (`src/services/*`):** Orchestrates domain logic, DB transactions, AI provider calls, and permission checks. Pure TypeScript, easily unit-testable.
- **Data Access (`src/lib/supabase/*`):** Supabase client initializers, typed query builders, database schema types.
- **AI Providers (`src/lib/ai/*`):** Abstract interfaces and concrete adapters for LLMs, image, video, and speech models.

## 3. Naming Conventions & Code Style
- Files: kebab-case (`creator-profile-card.tsx`, `use-workspace.ts`, `auth-service.ts`).
- React Components: PascalCase (`CreatorProfileCard`).
- Functions & Variables: camelCase (`getWorkspaceById`).
- Constants & Enums: UPPER_SNAKE_CASE (`MAX_PROMPT_TOKENS`).
- Types & Interfaces: PascalCase (`WorkspaceMember`, `AIProviderConfig`).

## 4. UI/UX Standards
- Responsive desktop-first design, fully adapted for mobile screens.
- Support Dark Mode and Light Mode with flawless contrast (WCAG AA minimum).
- Every asynchronous action must have a visible loading state (spinner or skeleton) and an explicit error state.
