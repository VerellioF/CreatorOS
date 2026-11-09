import { describe, it, expect, beforeEach } from "vitest";
import nextConfig from "../../next.config";
import {
  assertNotServiceRoleKey,
  buildSafeWorkspaceSlug,
  isValidUuid,
  sanitizeRedirectPath,
  stripControlChars,
} from "@/lib/security/sanitize";
import { checkRateLimit, resetRateLimitStore } from "@/lib/security/rate-limit";
import { signInSchema, signUpSchema, updateProfileSchema } from "@/lib/validation/auth-schemas";
import {
  createWorkspaceSchema,
  updateWorkspaceSettingsSchema,
  uuidSchema,
} from "@/lib/validation/workspace-schemas";

function encodeBase64Url(json: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(json), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("Application Security Hardening Suite", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  describe("1. Open Redirect & Path Sanitization (sanitizeRedirectPath)", () => {
    it("allows valid internal application routes with query strings", () => {
      expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
      expect(sanitizeRedirectPath("/settings?tab=workspace")).toBe("/settings?tab=workspace");
      expect(sanitizeRedirectPath("/creator-profile#dna")).toBe("/creator-profile#dna");
    });

    it("blocks external URLs, protocol-relative //, backslashes, javascript:/data: schemes, and auth loops", () => {
      expect(sanitizeRedirectPath("https://evil-phishing.com/steal")).toBe("/dashboard");
      expect(sanitizeRedirectPath("http://evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectPath("//evil.com/login")).toBe("/dashboard");
      expect(sanitizeRedirectPath("/\\evil.com")).toBe("/dashboard");
      expect(sanitizeRedirectPath("javascript:alert(document.cookie)")).toBe("/dashboard");
      expect(sanitizeRedirectPath("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
      expect(sanitizeRedirectPath("/sign-in?redirectTo=/dashboard")).toBe("/dashboard");
      expect(sanitizeRedirectPath("/sign-up")).toBe("/dashboard");
      expect(sanitizeRedirectPath("/forgot-password")).toBe("/dashboard");
      expect(sanitizeRedirectPath(null)).toBe("/dashboard");
      expect(sanitizeRedirectPath("")).toBe("/dashboard");
    });
  });

  describe("2. Service-Role Secret Exposure Guard (assertNotServiceRoleKey)", () => {
    it("allows valid Supabase anon JWT and publishable keys", () => {
      const fakeAnonJwt = `${encodeBase64Url({ alg: "HS256", typ: "JWT" })}.${encodeBase64Url({
        role: "anon",
        iss: "supabase",
      })}.sig`;

      expect(() => assertNotServiceRoleKey(fakeAnonJwt)).not.toThrow();
      expect(() => assertNotServiceRoleKey("sb_publishable_example_123")).not.toThrow();
    });

    it("throws fatal security violation when NEXT_PUBLIC_* contains service_role JWT or sb_secret_*", () => {
      const fakeServiceRoleJwt = `${encodeBase64Url({
        alg: "HS256",
        typ: "JWT",
      })}.${encodeBase64Url({
        role: "service_role",
        iss: "supabase",
      })}.sig`;

      expect(() => assertNotServiceRoleKey(fakeServiceRoleJwt)).toThrow(
        /CRITICAL SECURITY VIOLATION/
      );
      expect(() => assertNotServiceRoleKey("sb_secret_live_supersecret")).toThrow(
        /CRITICAL SECURITY VIOLATION/
      );
    });
  });

  describe("3. Sliding-Window Rate Limiter (checkRateLimit)", () => {
    it("enforces request quota inside window and resets cleanly after window expires", () => {
      const t0 = 1_700_000_000_000;
      const r1 = checkRateLimit({ key: "auth:ip1:user@example.com", limit: 2, windowMs: 60_000, now: t0 });
      const r2 = checkRateLimit({ key: "auth:ip1:user@example.com", limit: 2, windowMs: 60_000, now: t0 + 1_000 });
      const r3 = checkRateLimit({ key: "auth:ip1:user@example.com", limit: 2, windowMs: 60_000, now: t0 + 2_000 });

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(false);
      expect(r3.retryAfterSeconds).toBeGreaterThan(0);

      const afterExpiry = checkRateLimit({
        key: "auth:ip1:user@example.com",
        limit: 2,
        windowMs: 60_000,
        now: t0 + 61_000,
      });
      expect(afterExpiry.allowed).toBe(true);
    });
  });

  describe("4. Strict Zod Validation, Control-Char Stripping & Mass-Assignment Rejection", () => {
    it("strips control characters, normalizes email, and rejects injected extra fields (.strict())", () => {
      const clean = signInSchema.safeParse({
        email: "  USER\r\n@Example.COM ",
        password: "validPassword123",
      });
      expect(clean.success).toBe(true);
      if (clean.success) {
        expect(clean.data.email).toBe("user@example.com");
      }

      const massAssign = updateProfileSchema.safeParse({
        fullName: "Creator Valid",
        preferredLanguage: "id",
        themePreference: "dark",
        role: "owner",
      });
      expect(massAssign.success).toBe(false);

      const oversizedPw = signUpSchema.safeParse({
        fullName: "Budi",
        email: "budi@creator.id",
        password: "a".repeat(200),
        confirmPassword: "a".repeat(200),
      });
      expect(oversizedPw.success).toBe(false);
    });

    it("blocks reserved system slugs, malformed hyphens, non-UUIDs, and unapproved AI models", () => {
      expect(
        createWorkspaceSchema.safeParse({
          name: "Admin Squat",
          slug: "admin",
          creatorMode: "creator",
        }).success
      ).toBe(false);

      expect(
        createWorkspaceSchema.safeParse({
          name: "Bad Hyphen",
          slug: "-bad--slug-",
          creatorMode: "creator",
        }).success
      ).toBe(false);

      expect(
        updateWorkspaceSettingsSchema.safeParse({
          name: "My Workspace",
          creatorMode: "creator",
          defaultLanguage: "id",
          defaultAiModel: "evil-unapproved-model; DROP TABLE",
          enableAutoHashtag: true,
          notifyOnPublish: true,
        }).success
      ).toBe(false);

      expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
      expect(isValidUuid("10000000-0000-4000-8000-000000000001")).toBe(true);
      expect(stripControlChars("Hello\u0000\r\nWorld")).toBe("HelloWorld");

      const safeSlug = buildSafeWorkspaceSlug("admin", "10000000-0000-4000-8000-000000000001");
      expect(safeSlug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(safeSlug).not.toBe("admin");
    });
  });

  describe("5. HTTP Security Headers & CSP Configuration (next.config.ts)", () => {
    it("attaches CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, and Permissions-Policy", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const rules = await nextConfig.headers!();
      expect(rules.length).toBeGreaterThan(0);

      const headerMap = Object.fromEntries(
        rules[0]!.headers.map((h) => [h.key, h.value])
      );

      expect(headerMap["X-Frame-Options"]).toBe("DENY");
      expect(headerMap["X-Content-Type-Options"]).toBe("nosniff");
      expect(headerMap["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headerMap["Strict-Transport-Security"]).toContain("max-age=63072000");
      expect(headerMap["Permissions-Policy"]).toContain("camera=()");
      expect(headerMap["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
      expect(headerMap["Content-Security-Policy"]).toContain("object-src 'none'");
    });
  });
});
