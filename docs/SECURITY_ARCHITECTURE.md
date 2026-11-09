# SECURITY ARCHITECTURE SPECIFICATION — CREATOROS AI

## 1. THREAT MODEL & DEFENSE-IN-DEPTH

CreatorOS AI handles proprietary creator strategies, social tokens, commercial video scripts, and financial transactions. A defense-in-depth security model is enforced across all layers:

```
[Browser Client]
       │
       ▼  (HTTPS / TLS 1.3 + Content-Security-Policy)
[Next.js Middleware & Route Handlers]
       │  • Supabase Auth JWT Verification
       │  • Workspace Access Verification
       │  • Rate Limiting (Upstash / Redis)
       │  • Input Validation (Zod Schemas)
       ▼
[Typed Domain Service Layer]
       │  • Business logic authorization
       │  • Credit balance checks
       │  • Safe error normalization (Zero stack leak)
       ▼
[Supabase PostgreSQL Layer]
       │  • Mandatory Row Level Security (RLS)
       │  • Encrypted Sensitive Columns (AES-256-GCM)
       │  • Audit Log Triggers
```

---

## 2. ROW LEVEL SECURITY (RLS) PROTOCOL

1. **Default Deny:** Every table has RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). By default, zero rows are accessible unless explicitly granted by a policy.
2. **Context Binding:** Data access is bound to the verified caller's `auth.uid()`.
3. **Workspace Access Helper:**
   ```sql
   CREATE OR REPLACE FUNCTION user_has_workspace_role(
     target_workspace_id UUID, 
     allowed_roles TEXT[]
   ) RETURNS BOOLEAN AS $$
   BEGIN
     RETURN EXISTS (
       SELECT 1 FROM workspace_members
       WHERE workspace_id = target_workspace_id
         AND user_id = auth.uid()
         AND role = ANY(allowed_roles)
     );
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```
4. **Testing Protocol:** Automated integration tests must simulate unauthorized requests across tenant boundaries to verify that cross-workspace access attempts yield 0 records or throw an authorization violation.

---

## 3. SECRETS MANAGEMENT & CREDENTIAL ISOLATION

- **Public vs. Private Environment Variables:**
  - `NEXT_PUBLIC_*` is strictly audited and limited to non-sensitive values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`).
  - Private secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `MIDTRANS_SERVER_KEY`, `ENCRYPTION_SECRET`) are never packaged in client bundles.
- **Social Token Encryption:**
  - Social media OAuth tokens are encrypted at rest using AES-GCM-256 before storage in `social_accounts`.
- **Environment Validation:**
  - All environment variables are validated at build and runtime via a type-safe Zod schema in `src/lib/env/env.ts`. Missing variables halt server startup immediately.

---

## 4. INPUT VALIDATION & SANITIZATION

- Every Server Action and API Route Handler validates inputs against strict Zod schemas before passing arguments to the service layer.
- Text inputs rendered in HTML contexts undergo strict sanitization to prevent Stored Cross-Site Scripting (XSS).
- File uploads are validated for MIME type, file extension, and maximum byte size prior to streaming to Supabase Storage.

---

## 5. PAYMENT SECURITY & WEBHOOK INTEGRITY

- Midtrans webhook callbacks are validated against cryptographic HMAC/SHA-512 signatures using the private server key.
- Webhook endpoints are idempotent: processing uses atomic database transactions with uniqueness constraints on order IDs and transaction statuses.

---

## 6. AUDIT LOGGING & COMPLIANCE

- All security-relevant actions (member role change, workspace deletion, social account disconnection, subscription tier modification) are recorded in `audit_logs` with timestamps, actor IDs, and IP addresses.
- Logs do not store plaintext passwords, auth tokens, or payment card numbers.
