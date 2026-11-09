"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthService } from "@/services/auth-service";
import { StrategyService } from "@/services/strategy-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import { stripControlChars } from "@/lib/security/sanitize";
import {
  brandProfileInputSchema,
  contentPillarEditableSchema,
  updateStrategyOverviewSchema,
  type BrandProfileInput,
  type ContentPillarEditableInput,
  type UpdateStrategyOverviewInput,
} from "@/lib/validation/strategy-and-content-schemas";
import { uuidSchema } from "@/lib/validation/workspace-schemas";

const ONE_MINUTE_MS = 60 * 1_000;

const generateStrategyParamsSchema = z
  .object({
    researchReportId: uuidSchema.nullable().optional(),
    customFocusNotes: z
      .string()
      .transform((v) => stripControlChars(v).trim())
      .pipe(z.string().max(400))
      .optional(),
    weeklyCadence: z.number().int().min(1).max(21).optional(),
  })
  .strict();

function revalidateStrategyRoutes() {
  revalidatePath("/strategy");
  revalidatePath("/ideas");
  revalidatePath("/studio/scripts");
  revalidatePath("/usage");
  revalidatePath("/dashboard");
}

export async function saveBrandProfileAction(
  workspaceId: string,
  rawInput: BrandProfileInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const inputParsed = brandProfileInputSchema.safeParse(rawInput);
  if (!wsParsed.success || !inputParsed.success) {
    return {
      success: false as const,
      error:
        (!inputParsed.success && inputParsed.error.issues[0]?.message) ||
        "Input Brand Context tidak valid.",
    };
  }

  try {
    const brand = await StrategyService.upsertBrandProfile(
      wsParsed.data,
      user.id,
      inputParsed.data
    );
    revalidateStrategyRoutes();
    return { success: true as const, brand };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menyimpan Brand Context.",
    };
  }
}

export async function generateContentStrategyAction(
  workspaceId: string,
  rawParams: {
    researchReportId?: string | null;
    customFocusNotes?: string;
    weeklyCadence?: number;
  }
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const paramsParsed = generateStrategyParamsSchema.safeParse(rawParams);
  if (!wsParsed.success || !paramsParsed.success) {
    return {
      success: false as const,
      error: "Parameter strategi konten tidak valid.",
    };
  }

  const rate = await enforceServerActionRateLimit({
    action: "strategy:generate",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 5,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas generasi strategi tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const res = await StrategyService.generateContentStrategy(
      wsParsed.data,
      user.id,
      paramsParsed.data
    );
    revalidateStrategyRoutes();
    return {
      success: true as const,
      strategy: res.strategy,
      remainingCredits: res.remainingCredits,
      totalTokens: res.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error ? err.message : "Gagal menyusun strategi konten AI.",
    };
  }
}

export async function ensureManualStrategyAction(workspaceId: string) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };
  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) return { success: false as const, error: "Workspace tidak valid." };

  try {
    const strategy = await StrategyService.createManualStrategyIfMissing(
      wsParsed.data,
      user.id
    );
    revalidateStrategyRoutes();
    return { success: true as const, strategy };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal membuat kerangka strategi.",
    };
  }
}

export async function updateStrategyOverviewAction(
  workspaceId: string,
  rawInput: UpdateStrategyOverviewInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const inputParsed = updateStrategyOverviewSchema.safeParse(rawInput);
  if (!wsParsed.success || !inputParsed.success) {
    return {
      success: false as const,
      error:
        (!inputParsed.success && inputParsed.error.issues[0]?.message) ||
        "Data strategi tidak valid.",
    };
  }

  try {
    await StrategyService.updateStrategyOverview(
      wsParsed.data,
      user.id,
      inputParsed.data
    );
    revalidateStrategyRoutes();
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal memperbarui strategi.",
    };
  }
}

export async function upsertContentPillarAction(
  workspaceId: string,
  rawInput: ContentPillarEditableInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const inputParsed = contentPillarEditableSchema.safeParse(rawInput);
  if (!wsParsed.success || !inputParsed.success) {
    return {
      success: false as const,
      error:
        (!inputParsed.success && inputParsed.error.issues[0]?.message) ||
        "Input pilar konten tidak valid.",
    };
  }

  try {
    const pillar = await StrategyService.upsertContentPillar(
      wsParsed.data,
      user.id,
      inputParsed.data
    );
    revalidateStrategyRoutes();
    return { success: true as const, pillar };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menyimpan pilar konten.",
    };
  }
}

export async function deleteContentPillarAction(
  workspaceId: string,
  pillarId: string
) {
  const user = await AuthService.getCurrentUser();
  if (!user) return { success: false as const, error: "Sesi tidak valid." };

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const pilParsed = uuidSchema.safeParse(pillarId);
  if (!wsParsed.success || !pilParsed.success) {
    return { success: false as const, error: "ID tidak valid." };
  }

  try {
    await StrategyService.deleteContentPillar(
      wsParsed.data,
      user.id,
      pilParsed.data
    );
    revalidateStrategyRoutes();
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menghapus pilar konten.",
    };
  }
}
