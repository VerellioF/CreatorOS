import { z } from "zod";
import { assertNotServiceRoleKey } from "@/lib/security/sanitize";

const PLACEHOLDER_SUPABASE_URL = "https://placeholder-project.supabase.co";
const PLACEHOLDER_SUPABASE_ANON_KEY = "placeholder-anon-key";

const publicEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default(PLACEHOLDER_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default(PLACEHOLDER_SUPABASE_ANON_KEY),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type Env = z.infer<typeof serverEnvSchema>;

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

/**
 * Validates and returns public Supabase credentials safe for browser, server, and middleware.
 * Rejects accidental `service_role` keys in `NEXT_PUBLIC_*` and fails closed at production runtime
 * if real Supabase credentials are missing or still set to placeholders.
 */
export function getPublicSupabaseConfig(): { url: string; anonKey: string } {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (rawAnonKey) {
    assertNotServiceRoleKey(rawAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (isProductionRuntime()) {
    if (
      !rawUrl ||
      !rawAnonKey ||
      rawUrl.includes("placeholder") ||
      rawAnonKey.includes("placeholder")
    ) {
      throw new Error(
        "CRITICAL CONFIGURATION ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be configured with real non-placeholder values in production."
      );
    }
  }

  const parsed = publicEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: rawUrl || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: rawAnonKey || undefined,
  });

  if (!parsed.success) {
    throw new Error("Invalid public Supabase environment variables");
  }

  assertNotServiceRoleKey(parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function validateServerEnv(): Env {
  const result = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
  });

  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  assertNotServiceRoleKey(result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return result.data;
}

export const env = validateServerEnv();
