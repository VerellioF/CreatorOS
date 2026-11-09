"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthService } from "@/services/auth-service";
import { OnboardingService } from "@/services/onboarding-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import { uuidSchema } from "@/lib/validation/workspace-schemas";
import {
  audiencePersonaSchema,
  creatorDnaEditableSchema,
  onboardingCoreAnswersSchema,
  type AudiencePersona,
  type CreatorDnaEditable,
  type OnboardingCoreAnswers,
} from "@/lib/validation/creator-intelligence-schemas";

const ONE_MINUTE_MS = 60 * 1_000;

function revalidateIntelligenceRoutes() {
  revalidatePath("/creator-profile");
  revalidatePath("/niche-discovery");
  revalidatePath("/dashboard");
}

export async function saveCoreOnboardingAction(
  workspaceId: string,
  input: OnboardingCoreAnswers
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "onboarding:save-core",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 30,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Terlalu banyak permintaan penyimpanan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsed = onboardingCoreAnswersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message || "Data onboarding tidak valid.",
    };
  }

  try {
    const result = await OnboardingService.saveCoreAnswers(
      wsParsed.data,
      user.id,
      parsed.data
    );
    revalidateIntelligenceRoutes();
    return {
      success: true as const,
      adaptiveQuestions: result.adaptiveQuestions,
    };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menyimpan onboarding.",
    };
  }
}

export async function generateAiAdaptiveQuestionsAction(workspaceId: string) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "onboarding:ai-adaptive-questions",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 8,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas permintaan AI tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const result = await OnboardingService.generateAiAdaptiveQuestions(
      wsParsed.data,
      user.id
    );
    revalidateIntelligenceRoutes();
    return {
      success: true as const,
      coachSummary: result.coachSummary,
      questions: result.questions,
      remainingCredits: result.remainingCredits,
      totalTokens: result.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Gagal menghasilkan pertanyaan adaptif AI.",
    };
  }
}

export async function saveAdaptiveAnswersAction(
  workspaceId: string,
  answers: Record<string, string>
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "onboarding:save-adaptive",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 30,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Terlalu banyak permintaan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const saved = await OnboardingService.saveAdaptiveAnswers(
      wsParsed.data,
      user.id,
      answers
    );
    revalidateIntelligenceRoutes();
    return { success: true as const, answers: saved };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Gagal menyimpan jawaban wawancara adaptif.",
    };
  }
}

export async function synthesizeCreatorIntelligenceAction(workspaceId: string) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "onboarding:synthesize-dna",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 5,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Batas sintesis AI tercapai. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const result = await OnboardingService.synthesizeCreatorIntelligence(
      wsParsed.data,
      user.id
    );
    revalidateIntelligenceRoutes();
    return {
      success: true as const,
      synthesis: result.synthesis,
      remainingCredits: result.remainingCredits,
      totalTokens: result.totalTokens,
    };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error
          ? err.message
          : "Gagal menyusun Creator DNA & Roadmap.",
    };
  }
}

export async function updateCreatorDnaAction(
  workspaceId: string,
  dnaInput: CreatorDnaEditable,
  personaInput?: AudiencePersona | null
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "creator-dna:update",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 25,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Terlalu banyak pembaruan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  const parsedDna = creatorDnaEditableSchema.safeParse(dnaInput);
  if (!parsedDna.success) {
    return {
      success: false as const,
      error: parsedDna.error.issues[0]?.message || "Data Creator DNA tidak valid.",
    };
  }

  let validatedPersona: AudiencePersona | null = null;
  if (personaInput) {
    const parsedPersona = audiencePersonaSchema.safeParse(personaInput);
    if (!parsedPersona.success) {
      return {
        success: false as const,
        error:
          parsedPersona.error.issues[0]?.message ||
          "Data Audience Persona tidak valid.",
      };
    }
    validatedPersona = parsedPersona.data;
  }

  try {
    const updated = await OnboardingService.saveEditableCreatorDna(
      wsParsed.data,
      user.id,
      parsedDna.data,
      validatedPersona
    );
    revalidateIntelligenceRoutes();
    return { success: true as const, creatorDna: updated };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Gagal menyimpan Creator DNA.",
    };
  }
}

const toggleRoadmapInputSchema = z
  .object({
    taskId: z.string().trim().min(2).max(60),
    completed: z.boolean(),
  })
  .strict();

export async function toggleRoadmapTaskAction(
  workspaceId: string,
  taskId: string,
  completed: boolean
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false as const, error: "Sesi autentikasi tidak valid." };
  }

  const wsParsed = uuidSchema.safeParse(workspaceId);
  if (!wsParsed.success) {
    return { success: false as const, error: "Identitas workspace tidak valid." };
  }

  const parsedInput = toggleRoadmapInputSchema.safeParse({ taskId, completed });
  if (!parsedInput.success) {
    return { success: false as const, error: "Parameter tugas tidak valid." };
  }

  const rate = await enforceServerActionRateLimit({
    action: "roadmap:toggle-task",
    identifier: `${user.id}:${wsParsed.data}`,
    limit: 60,
    windowMs: ONE_MINUTE_MS,
  });
  if (!rate.allowed) {
    return {
      success: false as const,
      error: `Terlalu banyak permintaan. Coba lagi dalam ${rate.retryAfterSeconds} detik.`,
    };
  }

  try {
    const updatedRoadmap = await OnboardingService.toggleRoadmapTaskCompletion(
      wsParsed.data,
      user.id,
      parsedInput.data.taskId,
      parsedInput.data.completed
    );
    revalidateIntelligenceRoutes();
    return { success: true as const, roadmap30Days: updatedRoadmap };
  } catch (err) {
    return {
      success: false as const,
      error:
        err instanceof Error ? err.message : "Gagal memperbarui tugas roadmap.",
    };
  }
}
