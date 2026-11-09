"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthService } from "@/services/auth-service";
import { NicheDiscoveryService } from "@/services/niche-discovery-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import { stripControlChars } from "@/lib/security/sanitize";
import { uuidSchema } from "@/lib/validation/workspace-schemas";

const ONE_MINUTE_MS = 60 * 1_000;

const focusHintSchema = z
  .string()
  .transform((v) => stripControlChars(v).trim())
  .pipe(z.string().max(300, "Catatan fokus maksimal 300 karakter"))
  .optional();

function revalidateNicheRoutes() {
  revalidatePath("/niche-discovery");
  revalidatePath("/creator-profile");
  revalidatePath("/dashboard");
}

export async function generateNicheRecommendationsAction(
  workspaceId: string,
  customFocusHint?: string
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const hintParsed = focusHintSchema.safeParse(customFocusHint);
  if (!hintParsed.success) {
    return {
      success: false as const,
      error: hintParsed.error.issues[0]?.message || "Input fokus tidak valid.",
    };
  }

  const rate = await enforceServerActionRateLimit({
    action: "niche:generate",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 6,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas eksplorasi AI tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const result = await NicheDiscoveryService.generateRecommendations(
      wsParsed.data,
      user.id,
      { customFocusHint: hintParsed.data }
    );
    revalidateNicheRoutes();
    return {
      success: true as const,
      recommendations: result.recommendations,
      remainingCredits: result.remainingCredits,
      totalTokens: result.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Gagal menghasilkan rekomendasi niche.",
    };
  }
}

export async function selectPreferredNicheAction(
  workspaceId: string,
  nicheId: string
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const nicheParsed = uuidSchema.safeParse(nicheId);
  if (!wsParsed.success || !nicheParsed.success) {
    return {
      success: false as const,
      error: "Identitas workspace atau niche tidak valid.",
    };
  }

  const rate = await enforceServerActionRateLimit({
    action: "niche:select",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 25,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Terlalu banyak permintaan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const selectedTitle = await NicheDiscoveryService.selectPreferredNiche(
      wsParsed.data,
      user.id,
      nicheParsed.data
    );
    revalidateNicheRoutes();
    return {
      success: true as const,
      selectedNicheTitle: selectedTitle,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal memilih niche utama.",
    };
  }
}
