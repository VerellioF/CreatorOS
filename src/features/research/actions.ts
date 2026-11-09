"use server";

import { revalidatePath } from "next/cache";
import { AuthService } from "@/services/auth-service";
import { ResearchService } from "@/services/research-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import {
  competitorProfileInputSchema,
  generateResearchRequestSchema,
  type CompetitorProfileInput,
  type GenerateResearchRequest,
} from "@/lib/validation/research-schemas";
import { uuidSchema } from "@/lib/validation/workspace-schemas";

const ONE_MINUTE_MS = 60 * 1_000;

function revalidateResearchRoutes() {
  revalidatePath("/trends");
  revalidatePath("/competitors");
  revalidatePath("/strategy");
  revalidatePath("/ideas");
  revalidatePath("/studio/scripts");
  revalidatePath("/usage");
  revalidatePath("/dashboard");
}

export async function generateResearchReportAction(
  workspaceId: string,
  rawInput: GenerateResearchRequest
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const inputParsed = generateResearchRequestSchema.safeParse(rawInput);
  if (!inputParsed.success) {
    return {
      success: false as const,
      error:
        inputParsed.error.issues[0]?.message ||
        "Parameter permintaan riset tidak valid.",
    };
  }

  const rate = await enforceServerActionRateLimit({
    action: "research:generate",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 6,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas riset AI tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const result = await ResearchService.generateResearchReport(
      wsParsed.data,
      user.id,
      inputParsed.data
    );
    revalidateResearchRoutes();
    return {
      success: true as const,
      report: result.report,
      remainingCredits: result.remainingCredits,
      totalTokens: result.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Gagal menghasilkan laporan riset berbasis sumber.",
    };
  }
}

export async function saveCompetitorProfileAction(
  workspaceId: string,
  rawInput: CompetitorProfileInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const parsed = competitorProfileInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false as const,
      error:
        parsed.error.issues[0]?.message || "Data profil kompetitor tidak valid.",
    };
  }

  const rate = await enforceServerActionRateLimit({
    action: "competitor:save",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 20,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Terlalu banyak permintaan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const profile = await ResearchService.saveCompetitorProfile(
      wsParsed.data,
      user.id,
      parsed.data
    );
    revalidateResearchRoutes();
    return { success: true as const, profile };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error ? err.message : "Gagal menyimpan profil kompetitor.",
    };
  }
}

export async function deleteCompetitorProfileAction(
  workspaceId: string,
  competitorId: string
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  const compParsed = uuidSchema.safeParse(competitorId);
  if (!wsParsed.success || !compParsed.success) {
    return { success: false as const, error: "ID tidak valid." };
  }

  try {
    await ResearchService.deleteCompetitorProfile(
      wsParsed.data,
      user.id,
      compParsed.data
    );
    revalidateResearchRoutes();
    return { success: true as const };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menghapus kompetitor.",
    };
  }
}
