"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthService } from "@/services/auth-service";
import { ContentEngineService } from "@/services/content-engine-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import { stripControlChars } from "@/lib/security/sanitize";
import { platformIdEnum } from "@/lib/validation/creator-intelligence-schemas";
import {
  adaptContentPlatformRequestSchema,
  generateContentPackageRequestSchema,
  saveContentIdeaSchema,
  saveEditableContentPackageSchema,
  type AdaptContentPlatformRequest,
  type GenerateContentPackageRequest,
  type SaveContentIdeaInput,
  type SaveEditableContentPackageInput,
} from "@/lib/validation/strategy-and-content-schemas";
import { uuidSchema } from "@/lib/validation/workspace-schemas";

const ONE_MINUTE_MS = 60 * 1_000;

const generateIdeasParamsSchema = z
  .object({
    targetPlatform: platformIdEnum,
    count: z.number().int().min(4).max(10).optional(),
    pillarId: uuidSchema.nullable().optional(),
    researchReportId: uuidSchema.nullable().optional(),
    customTopicFocus: z
      .string()
      .transform((v) => stripControlChars(v).trim())
      .pipe(z.string().max(350))
      .optional(),
  })
  .strict();

function revalidateContentRoutes() {
  revalidatePath("/ideas");
  revalidatePath("/studio/scripts");
  revalidatePath("/usage");
  revalidatePath("/dashboard");
}

export async function generateContentIdeasAction(
  workspaceId: string,
  rawParams: z.infer<typeof generateIdeasParamsSchema>
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const paramsParsed = generateIdeasParamsSchema.safeParse(rawParams);
  if (!wsParsed.success || !paramsParsed.success) {
    return { success: false as const, error: "Parameter generasi ide tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "ideas:generate",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 8,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas generasi ide tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const res = await ContentEngineService.generateIdeas(
      wsParsed.data,
      user.id,
      paramsParsed.data
    );
    revalidateContentRoutes();
    return {
      success: true as const,
      ideas: res.ideas,
      remainingCredits: res.remainingCredits,
      totalTokens: res.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menghasilkan ide konten.",
    };
  }
}

export async function saveContentIdeaAction(
  workspaceId: string,
  rawInput: SaveContentIdeaInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const parsed = saveContentIdeaSchema.safeParse(rawInput);
  if (!wsParsed.success || !parsed.success) {
    return {
      success: false as const,
      error:
        (!parsed.success && parsed.error.issues[0]?.message) ||
        "Data ide konten tidak valid.",
    };
  }

  try {
    const idea = await ContentEngineService.saveIdea(
      wsParsed.data,
      user.id,
      parsed.data
    );
    revalidateContentRoutes();
    return { success: true as const, idea };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menyimpan ide konten.",
    };
  }
}

export async function deleteContentIdeaAction(
  workspaceId: string,
  ideaId: string
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const ideaParsed = uuidSchema.safeParse(ideaId);
  if (!wsParsed.success || !ideaParsed.success) {
    return { success: false as const, error: "ID tidak valid." };
  }

  try {
    await ContentEngineService.deleteIdea(wsParsed.data, user.id, ideaParsed.data);
    revalidateContentRoutes();
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menghapus ide.",
    };
  }
}

export async function generateContentPackageAction(
  workspaceId: string,
  rawInput: GenerateContentPackageRequest
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const parsed = generateContentPackageRequestSchema.safeParse(rawInput);
  if (!wsParsed.success || !parsed.success) {
    return {
      success: false as const,
      error:
        (!parsed.success && parsed.error.issues[0]?.message) ||
        "Parameter skrip tidak valid.",
    };
  }

  const rate = await enforceServerActionRateLimit({
    action: "content:generate_package",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 6,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas generasi konten tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const res = await ContentEngineService.generateContentPackage(
      wsParsed.data,
      user.id,
      parsed.data
    );
    revalidateContentRoutes();
    return {
      success: true as const,
      contentPackage: res.contentPackage,
      remainingCredits: res.remainingCredits,
      totalTokens: res.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menghasilkan paket konten.",
    };
  }
}

export async function adaptContentPlatformAction(
  workspaceId: string,
  rawInput: AdaptContentPlatformRequest
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const parsed = adaptContentPlatformRequestSchema.safeParse(rawInput);
  if (!wsParsed.success || !parsed.success) {
    return { success: false as const, error: "Parameter adaptasi platform tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "content:adapt_platform",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 8,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas adaptasi tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const res = await ContentEngineService.adaptContentToPlatform(
      wsParsed.data,
      user.id,
      parsed.data
    );
    revalidateContentRoutes();
    return {
      success: true as const,
      contentPackage: res.contentPackage,
      remainingCredits: res.remainingCredits,
      totalTokens: res.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal mengadaptasi konten ke platform.",
    };
  }
}

export async function saveEditableContentPackageAction(
  workspaceId: string,
  rawInput: SaveEditableContentPackageInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const parsed = saveEditableContentPackageSchema.safeParse(rawInput);
  if (!wsParsed.success || !parsed.success) {
    return {
      success: false as const,
      error:
        (!parsed.success && parsed.error.issues[0]?.message) ||
        "Input perubahan paket konten tidak valid.",
    };
  }

  try {
    const contentPackage = await ContentEngineService.saveEditableContentPackage(
      wsParsed.data,
      user.id,
      parsed.data
    );
    revalidateContentRoutes();
    return { success: true as const, contentPackage };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menyimpan perubahan konten.",
    };
  }
}
