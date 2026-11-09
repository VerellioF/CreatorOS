import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import {
  buildAdaptiveBaselineQuestions,
  formatCreatorContextPromptBlock,
} from "@/lib/ai/context-builder";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import type { TextGenerationProvider } from "@/lib/ai/types";
import {
  ADAPTIVE_QUESTIONS_JSON_SCHEMA,
  CREATOR_INTELLIGENCE_SYNTHESIS_JSON_SCHEMA,
} from "@/lib/ai/schemas/creator-intelligence-json-schemas";
import {
  adaptiveQuestionBatchSchema,
  audiencePersonaSchema,
  creatorDnaEditableSchema,
  creatorIntelligenceSynthesisSchema,
  onboardingCoreAnswersSchema,
  roadmapWeekSchema,
  saveAdaptiveAnswersSchema,
  type AdaptiveQuestionItem,
  type AudiencePersona,
  type CreatorDnaEditable,
  type CreatorIntelligenceSynthesis,
  type OnboardingCoreAnswers,
  type RoadmapWeek,
} from "@/lib/validation/creator-intelligence-schemas";
import type {
  CreatorProfileRow,
  Json,
  OnboardingSessionRow,
} from "@/lib/supabase/types";

interface CustomProviderOverrides {
  primary?: TextGenerationProvider;
  fallback?: TextGenerationProvider;
}

export class OnboardingService {
  private static async assertEditorAccess(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) {
      throw new Error(
        "Akses ditolak: peran Editor, Admin, atau Owner diperlukan pada workspace ini."
      );
    }
  }

  /**
   * Saves or updates the 9 foundational onboarding answers + Creator Mode,
   * and populates profile-adaptive follow-up questions so the interview adapts immediately.
   */
  static async saveCoreAnswers(
    workspaceId: string,
    userId: string,
    rawInput: OnboardingCoreAnswers
  ): Promise<{
    coreAnswers: OnboardingCoreAnswers;
    adaptiveQuestions: AdaptiveQuestionItem[];
  }> {
    await this.assertEditorAccess(workspaceId, userId);
    const parsed = onboardingCoreAnswersSchema.parse(rawInput);

    const supabase = await createClient();

    // Update workspace creator_mode if caller has admin/owner role
    const isAdmin = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "admin"
    );
    if (isAdmin) {
      await supabase
        .from("workspaces")
        .update({
          creator_mode: parsed.creatorMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);
    }

    const { data: existingData } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const existing = existingData as OnboardingSessionRow | null;
    const baselineQuestions = buildAdaptiveBaselineQuestions(parsed);

    // Preserve any existing AI-generated questions while ensuring adaptive baseline coverage
    const existingQuestions = Array.isArray(existing?.adaptive_questions)
      ? (existing.adaptive_questions as unknown as AdaptiveQuestionItem[])
      : [];
    const activeQuestions =
      existingQuestions.length >= 3 ? existingQuestions : baselineQuestions;

    const { error } = await supabase.from("onboarding_sessions").upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        status:
          existing?.status === "completed" ? "completed" : "adaptive_interview",
        current_step: 2,
        core_answers: parsed as unknown as Json,
        adaptive_questions: activeQuestions as unknown as Json,
        adaptive_answers: (existing?.adaptive_answers ?? {}) as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    );

    if (error) {
      throw new Error(`Gagal menyimpan data onboarding: ${error.message}`);
    }

    return {
      coreAnswers: parsed,
      adaptiveQuestions: activeQuestions,
    };
  }

  /**
   * Generates bespoke AI adaptive follow-up questions via OnboardingCoachAgent (Gemini 3.8).
   */
  static async generateAiAdaptiveQuestions(
    workspaceId: string,
    userId: string,
    customProviders?: CustomProviderOverrides
  ): Promise<{
    coachSummary: string;
    questions: AdaptiveQuestionItem[];
    remainingCredits: number;
    totalTokens: number;
  }> {
    await this.assertEditorAccess(workspaceId, userId);
    const context = await CreatorContextService.getWorkspaceCreatorContext(
      workspaceId,
      userId
    );

    if (!context.coreAnswers) {
      throw new Error(
        "Simpan jawaban dasar onboarding terlebih dahulu sebelum menghasilkan pertanyaan adaptif AI."
      );
    }

    const systemPrompt = [
      "Anda adalah OnboardingCoachAgent pada CreatorOS AI.",
      "Tugas Anda: mewawancarai kreator secara adaptif berdasarkan profil dasar mereka untuk menggali diferensiasi niche, hambatan produksi nyata, masalah spesifik audiens, dan kecocokan monetisasi.",
      "Gunakan Bahasa Indonesia yang ramah, tajam, dan praktis.",
      "DILARANG menjanjikan penghasilan pasti atau jaminan viral.",
    ].join("\n");

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      "",
      "Susun 4 pertanyaan wawancara lanjutan yang SANGAT SPESIFIK merujuk pada minat, keahlian, peralatan, waktu, dan tujuan kreator di atas.",
    ].join("\n");

    const result = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "OnboardingCoachAgent",
      operationType: "adaptive_interview_questions",
      preferredModel: "gemini-3.5-flash-lite",
      systemPrompt,
      userPrompt,
      schemaName: "AdaptiveQuestionBatch",
      jsonSchema: ADAPTIVE_QUESTIONS_JSON_SCHEMA,
      zodSchema: adaptiveQuestionBatchSchema,
      maxOutputTokens: 1800,
      thinkingLevel: "low",
      inputSummary: {
        creatorMode: context.creatorMode,
        interestsCount: context.coreAnswers.interests.length,
      },
      customProviders,
    });

    const supabase = await createClient();
    const { error } = await supabase
      .from("onboarding_sessions")
      .update({
        user_id: userId,
        status: "adaptive_interview",
        current_step: 2,
        adaptive_questions: result.data.questions as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new Error(`Gagal menyimpan pertanyaan adaptif: ${error.message}`);
    }

    return {
      coachSummary: result.data.coachSummary,
      questions: result.data.questions,
      remainingCredits: result.billing.remainingBalance,
      totalTokens: result.usage.totalTokens,
    };
  }

  /**
   * Saves or edits user answers to the adaptive interview questions.
   */
  static async saveAdaptiveAnswers(
    workspaceId: string,
    userId: string,
    rawAnswers: Record<string, string>
  ): Promise<Record<string, string>> {
    await this.assertEditorAccess(workspaceId, userId);

    // Strip empty entries before strict validation so users can save partial progress cleanly
    const filtered: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawAnswers)) {
      if (typeof val === "string" && val.trim().length > 0) {
        filtered[key] = val.trim();
      }
    }

    const parsed = saveAdaptiveAnswersSchema.parse({ answers: filtered });
    const supabase = await createClient();

    const { error } = await supabase
      .from("onboarding_sessions")
      .update({
        user_id: userId,
        adaptive_answers: parsed.answers as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId);

    if (error) {
      throw new Error(`Gagal menyimpan jawaban wawancara adaptif: ${error.message}`);
    }

    return parsed.answers;
  }

  /**
   * Synthesizes Creator DNA, Audience Persona, Creator Assessment, Monetization Recommendations,
   * and 30-Day Creator Roadmap from saved onboarding + adaptive interview answers.
   */
  static async synthesizeCreatorIntelligence(
    workspaceId: string,
    userId: string,
    customProviders?: CustomProviderOverrides
  ): Promise<{
    synthesis: CreatorIntelligenceSynthesis;
    remainingCredits: number;
    totalTokens: number;
  }> {
    await this.assertEditorAccess(workspaceId, userId);
    const context = await CreatorContextService.getWorkspaceCreatorContext(
      workspaceId,
      userId
    );

    if (!context.coreAnswers) {
      throw new Error(
        "Lengkapi dan simpan jawaban onboarding terlebih dahulu sebelum menghasilkan Creator DNA."
      );
    }

    const systemPrompt = [
      "Anda adalah Principal Creator Strategist & OnboardingCoachAgent pada CreatorOS AI.",
      "Berdasarkan jawaban onboarding dasar dan wawancara adaptif pengguna, sintesiskan:",
      "1. Creator DNA yang spesifik, autentik, dan bebas klise.",
      "2. Audience Persona yang tajam mencakup pain points, keinginan, kebiasaan konsumsi konten, dan keraguan.",
      "3. Creator Assessment jujur (skor 1-10 pada 5 dimensi kesiapan + kekuatan + bottleneck nyata).",
      "4. Monetization Recommendations realistis yang selaras dengan Creator Mode, waktu, dan alat pengguna TANPA menjanjikan penghasilan pasti atau viralitas.",
      "5. 30-Day Creator Roadmap (tepat 4 minggu: weekNumber 1 s.d. 4) berisi langkah konkret yang sesuai dengan waktu luang mingguan pengguna.",
    ].join("\n");

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      "",
      "Hasilkan sintesis lengkap Creator Intelligence dalam Bahasa Indonesia sesuai JSON Schema.",
    ].join("\n");

    const result = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "OnboardingCoachAgent",
      operationType: "creator_intelligence_synthesis",
      preferredModel: context.defaultAiModel,
      systemPrompt,
      userPrompt,
      schemaName: "CreatorIntelligenceSynthesis",
      jsonSchema: CREATOR_INTELLIGENCE_SYNTHESIS_JSON_SCHEMA,
      zodSchema: creatorIntelligenceSynthesisSchema,
      maxOutputTokens: 5500,
      thinkingLevel: "medium",
      inputSummary: {
        creatorMode: context.creatorMode,
        adaptiveAnswersCount: Object.keys(context.adaptiveAnswers).length,
      },
      customProviders,
    });

    const {
      creatorDna,
      audiencePersona,
      creatorAssessment,
      monetizationRecommendations,
      roadmap30Days,
    } = result.data;

    const supabase = await createClient();

    const { error: profileErr } = await supabase.from("creator_profiles").upsert(
      {
        workspace_id: workspaceId,
        creator_name: creatorDna.creatorName,
        primary_niche: creatorDna.primaryNiche,
        secondary_niches: creatorDna.secondaryNiches,
        unique_value_proposition: creatorDna.uniqueValueProposition,
        target_audience_summary: creatorDna.targetAudienceSummary,
        audience_persona: audiencePersona as unknown as Json,
        tone_of_voice: creatorDna.toneOfVoice,
        personality_archetype: creatorDna.personalityArchetype,
        strengths: creatorDna.strengths,
        taboo_topics: creatorDna.tabooTopics,
        primary_platforms: creatorDna.primaryPlatforms,
        preferred_formats: creatorDna.preferredFormats,
        assessment_scores: creatorAssessment as unknown as Json,
        monetization_recommendations:
          monetizationRecommendations as unknown as Json,
        roadmap_30_days: roadmap30Days as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    );

    if (profileErr) {
      throw new Error(`Gagal menyimpan Creator DNA: ${profileErr.message}`);
    }

    await Promise.all([
      supabase
        .from("onboarding_sessions")
        .update({
          user_id: userId,
          status: "completed",
          current_step: 4,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId),
      supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId),
    ]);

    return {
      synthesis: result.data,
      remainingCredits: result.billing.remainingBalance,
      totalTokens: result.usage.totalTokens,
    };
  }

  /**
   * Allows users to directly create or edit their Creator DNA & Audience Persona at any time.
   */
  static async saveEditableCreatorDna(
    workspaceId: string,
    userId: string,
    rawDna: CreatorDnaEditable,
    rawPersona?: AudiencePersona | null
  ): Promise<CreatorDnaEditable> {
    await this.assertEditorAccess(workspaceId, userId);
    const dna = creatorDnaEditableSchema.parse(rawDna);
    const persona = rawPersona ? audiencePersonaSchema.parse(rawPersona) : undefined;

    const supabase = await createClient();
    const { data: existingRow } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const existing = existingRow as CreatorProfileRow | null;

    const { error } = await supabase.from("creator_profiles").upsert(
      {
        workspace_id: workspaceId,
        creator_name: dna.creatorName,
        primary_niche: dna.primaryNiche,
        secondary_niches: dna.secondaryNiches,
        unique_value_proposition: dna.uniqueValueProposition,
        target_audience_summary: dna.targetAudienceSummary,
        audience_persona: (persona ?? existing?.audience_persona ?? {}) as Json,
        tone_of_voice: dna.toneOfVoice,
        personality_archetype: dna.personalityArchetype,
        strengths: dna.strengths,
        taboo_topics: dna.tabooTopics,
        primary_platforms: dna.primaryPlatforms,
        preferred_formats: dna.preferredFormats,
        assessment_scores: (existing?.assessment_scores ?? {}) as Json,
        monetization_recommendations: (existing?.monetization_recommendations ??
          []) as Json,
        roadmap_30_days: (existing?.roadmap_30_days ?? []) as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    );

    if (error) {
      throw new Error(`Gagal memperbarui Creator DNA: ${error.message}`);
    }

    await supabase
      .from("profiles")
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return dna;
  }

  /**
   * Persists interactive task completion toggles on the saved 30-day roadmap.
   */
  static async toggleRoadmapTaskCompletion(
    workspaceId: string,
    userId: string,
    taskId: string,
    completed: boolean
  ): Promise<RoadmapWeek[]> {
    await this.assertEditorAccess(workspaceId, userId);
    const supabase = await createClient();

    const { data: rowData, error: fetchErr } = await supabase
      .from("creator_profiles")
      .select("roadmap_30_days")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (fetchErr || !rowData) {
      throw new Error("Roadmap 30 hari belum tersedia pada workspace ini.");
    }

    const rawWeeks = (rowData as Pick<CreatorProfileRow, "roadmap_30_days">)
      .roadmap_30_days;
    if (!Array.isArray(rawWeeks)) {
      throw new Error("Format roadmap tidak valid.");
    }

    let found = false;
    const updatedWeeks: RoadmapWeek[] = rawWeeks.map((weekRaw) => {
      const week = roadmapWeekSchema.parse(weekRaw);
      return {
        ...week,
        tasks: week.tasks.map((task) => {
          if (task.id === taskId) {
            found = true;
            return { ...task, completed };
          }
          return task;
        }),
      };
    });

    if (!found) {
      throw new Error("Item tugas pada roadmap tidak ditemukan.");
    }

    const { error: saveErr } = await supabase
      .from("creator_profiles")
      .update({
        roadmap_30_days: updatedWeeks as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId);

    if (saveErr) {
      throw new Error(`Gagal memperbarui status tugas roadmap: ${saveErr.message}`);
    }

    return updatedWeeks;
  }
}
