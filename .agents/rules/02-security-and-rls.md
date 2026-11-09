# 02 - Security & Row Level Security (RLS) Protocol

## 1. Multi-Tenant Isolation
- In CreatorOS AI, multi-tenancy is scoped at the `workspace` level.
- Every business table MUST include a `workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`.
- Row Level Security (RLS) must be enabled on every table without exception:
  ```sql
  ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
  ```

## 2. Standard RLS Policy Pattern
- Policies must evaluate membership via `workspace_members`:
  ```sql
  CREATE POLICY "workspace_isolation_select" ON <table_name>
    FOR SELECT
    USING (
      workspace_id IN (
        SELECT wm.workspace_id 
        FROM workspace_members wm 
        WHERE wm.user_id = auth.uid()
      )
    );
  ```
- Mutations (INSERT, UPDATE, DELETE) must verify member roles (e.g., `owner`, `admin`, `member`, `viewer`).

## 3. Server-Side Authorization
- Client-side code CANNOT be trusted to enforce workspace boundaries.
- Every Server Action, Route Handler, or API endpoint must:
  1. Authenticate user session with Supabase Auth: `const { data: { user } } = await supabase.auth.getUser();`
  2. Verify user has active access to the target `workspace_id`.
  3. Validate input payload using Zod.

## 4. Secret & Key Management
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or AI provider API keys in `process.env.NEXT_PUBLIC_*`.
- Service role client is strictly restricted to server-side scripts, background workers, or system webhooks requiring elevation.
