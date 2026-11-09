export const RESERVED_WORKSPACE_SLUGS = [
  "admin",
  "api",
  "auth",
  "dashboard",
  "settings",
  "sign-in",
  "sign-up",
  "forgot-password",
  "studio",
  "strategy",
  "creator-profile",
  "niche-discovery",
  "billing",
  "onboarding",
  "system",
  "internal",
  "public",
  "login",
  "logout",
  "register",
] as const;

const RESERVED_SLUG_SET = new Set<string>(RESERVED_WORKSPACE_SLUGS);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;

/**
 * Strips ASCII control characters (including CR/LF/NUL) from untrusted text.
 */
export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_REGEX, "");
}

/**
 * Validates that a string is a canonical 36-character UUID.
 */
export function isValidUuid(value: string | null | undefined): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return UUID_REGEX.test(value.trim());
}

/**
 * Sanitizes an untrusted redirect target so it is guaranteed to be an internal
 * relative path on the current origin (prevents Open Redirect & protocol injection).
 */
export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (typeof raw !== "string") {
    return fallback;
  }

  const cleaned = stripControlChars(raw).trim();
  if (
    cleaned.length === 0 ||
    cleaned.length > 512 ||
    !cleaned.startsWith("/") ||
    cleaned.startsWith("//") ||
    cleaned.includes("\\")
  ) {
    return fallback;
  }

  try {
    const baseOrigin = "https://creatoros.internal";
    const parsed = new URL(cleaned, baseOrigin);

    if (
      parsed.origin !== baseOrigin ||
      !parsed.pathname.startsWith("/") ||
      parsed.pathname.startsWith("//")
    ) {
      return fallback;
    }

    // Prevent post-login redirect loops back onto authentication pages
    if (
      parsed.pathname.startsWith("/sign-in") ||
      parsed.pathname.startsWith("/sign-up") ||
      parsed.pathname.startsWith("/forgot-password")
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Generates a collision-resistant, constraint-compliant workspace slug (`^[a-z0-9]+(-[a-z0-9]+)*$`).
 */
export function buildSafeWorkspaceSlug(baseName: string, uniqueSeed?: string): string {
  const normalizedBase = stripControlChars(baseName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
    .replace(/-+$/g, "");

  const safePrefix =
    normalizedBase.length >= 2 && !RESERVED_SLUG_SET.has(normalizedBase)
      ? normalizedBase
      : "workspace";

  const seedHex = (uniqueSeed || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  const randomHex = Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");

  const suffix = seedHex.length >= 8 ? `${seedHex.slice(0, 8)}${randomHex.slice(0, 4)}` : randomHex;
  return `${safePrefix}-${suffix}`;
}

/**
 * Checks whether a workspace slug is reserved by system routes.
 */
export function isReservedWorkspaceSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug.trim().toLowerCase());
}

function decodeBase64UrlSegment(segment: string): string | null {
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    if (typeof atob === "function") {
      return atob(padded);
    }
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Prevents accidental exposure of a Supabase `service_role` or `sb_secret_` key
 * inside a `NEXT_PUBLIC_*` client-exposed environment variable (`AGENTS.md` Rule 4).
 */
export function assertNotServiceRoleKey(
  key: string,
  envName = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
): void {
  const trimmed = key.trim();
  if (trimmed.startsWith("sb_secret_")) {
    throw new Error(
      `CRITICAL SECURITY VIOLATION: ${envName} contains a Supabase secret key (sb_secret_*). Never expose service-role secrets in client variables.`
    );
  }

  const parts = trimmed.split(".");
  if (parts.length === 3 && parts[1]) {
    const decoded = decodeBase64UrlSegment(parts[1]);
    if (decoded) {
      try {
        const payload = JSON.parse(decoded) as { role?: unknown };
        if (payload.role === "service_role" || payload.role === "supabase_admin") {
          throw new Error(
            `CRITICAL SECURITY VIOLATION: ${envName} contains a privileged '${payload.role}' JWT. Never expose service-role keys in NEXT_PUBLIC_* variables.`
          );
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("CRITICAL SECURITY VIOLATION:")) {
          throw err;
        }
      }
    }
  }
}
