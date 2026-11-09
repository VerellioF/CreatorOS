import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { normalizeSupportedAiModel } from "@/lib/validation/workspace-schemas";
import {
  adaptiveQuestionItemSchema,
  audiencePersonaSchema,
  creatorAssessmentSchema,
  creatorDnaEditableSchema,
  monetizationRecommendationItemSchema,
  nicheRecommendationCandidateSchema,
  onboardingCoreAnswersSchema,
  roadmapWeekSchema,
  type AdaptiveQuestionItem,
  type AudiencePersona,
  type CreatorAssessment,
  type CreatorDnaEditable,
  type MonetizationRecommendationItem,
  type OnboardingCoreAnswers,
  type RoadmapWeek,
} from "@/lib/validation/creator-intelligence-schemas";
import {
  brandProfileInputSchema,
  type BrandProfileInput,
} from "@/lib/validation/strategy-and-content-schemas";
import type {
  ActiveStrategySummary,
  SelectedNicheSummary,
  WorkspaceCreatorContext,
} from "@/lib/ai/context-builder";
import type {
  BrandProfileRow,
  ContentPillarRow,
  ContentStrategyRow,
  CreatorProfileRow,
  NicheRecommendationRow,
  OnboardingSessionRow,
  Profile,
  Workspace,
  WorkspaceSettings,
} from "@/lib/supabase/types";

function parseJsonArraySafely<T>(
  raw: unknown,
  itemParser: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }
): T[] {
  if (!Array.isArray(raw)) return [];
  const items: T[] = [];
  for (const entry of raw) {
    const parsed = itemParser.safeParse(entry);
    if (parsed.success) {
      items.push(parsed.data);
    }
  }
  return items;
}

function parseNicheRow(row: NicheRecommendationRow): SelectedNicheSummary | null {
  const candidate = {
    nicheTitle: row.niche_title,
    explanation: row.explanation,
    audience: row.audience,
    contentOpportunities: row.content_opportunities,
    competitionAssessment: row.competition_assessment,
    requiredSkills: row.required_skills ?? [],
    monetizationPossibilities: row.monetization_possibilities,
    confidenceLevel: row.confidence_level,
    confidenceScore: row.confidence_score,
    supportingEvidence: row.supporting_evidence,
  };
  const parsed = nicheRecommendationCandidateSchema.safeParse(candidate);
  if (!parsed.success) return null;
  return {
    id: row.id,
    isSelected: row.is_selected,
    ...parsed.data,
  };
}

export class CreatorContextService {
  /**
   * Assembles the canonical `WorkspaceCreatorContext` for any module in CreatorOS AI.
   * Enforces server-side workspace membership check (`viewer`+) before reading tenant data.
   * Memoized per-request with React.cache() to prevent 6x redundant DB queries.
   */
  static getWorkspaceCreatorContext = cache(async (
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceCreatorContext> => {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke konteks kreator workspace ini.");
    }

    const supabase = await createClient();

    const [
      { data: workspaceData },
      { data: settingsData },
      { data: profileData },
      { data: onboardingData },
      { data: creatorProfileData },
      { data: selectedNicheData },
    ] = await Promise.all([
      supabase
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("workspace_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("onboarding_sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("creator_profiles")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("niche_recommendations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_selected", true)
        .maybeSingle(),
    ]);

    const workspace = workspaceData as Workspace | null;
    if (!workspace) {
      throw new Error("Workspace aktif tidak ditemukan.");
    }

    const settings = settingsData as WorkspaceSettings | null;
    const userProfile = profileData as Profile | null;
    const session = onboardingData as OnboardingSessionRow | null;
    const creatorRow = creatorProfileData as CreatorProfileRow | null;
    const selectedNicheRow = selectedNicheData as NicheRecommendationRow | null;

    // Parse core onboarding answers
    let coreAnswers: OnboardingCoreAnswers | null = null;
    if (session?.core_answers && typeof session.core_answers === "object") {
      const parsedCore = onboardingCoreAnswersSchema.safeParse(session.core_answers);
      if (parsedCore.success) {
        coreAnswers = parsedCore.data;
      }
    }

    // Parse adaptive questions & editable answers
    const adaptiveQuestions: AdaptiveQuestionItem[] = parseJsonArraySafely(
      session?.adaptive_questions,
      adaptiveQuestionItemSchema
    );

    const adaptiveAnswers: Record<string, string> = {};
    if (
      session?.adaptive_answers &&
      typeof session.adaptive_answers === "object" &&
      !Array.isArray(session.adaptive_answers)
    ) {
      for (const [k, v] of Object.entries(
        session.adaptive_answers as Record<string, unknown>
      )) {
        if (typeof v === "string") {
          adaptiveAnswers[k] = v;
        }
      }
    }

    // Parse Creator DNA + Audience Persona + Assessment + Monetization + 30-Day Roadmap
    let creatorDna: CreatorDnaEditable | null = null;
    let audiencePersona: AudiencePersona | null = null;
    let creatorAssessment: CreatorAssessment | null = null;
    let monetizationRecommendations: MonetizationRecommendationItem[] = [];
    let roadmap30Days: RoadmapWeek[] = [];

    if (creatorRow) {
      const dnaCandidate = {
        creatorName: creatorRow.creator_name,
        primaryNiche: creatorRow.primary_niche,
        secondaryNiches: creatorRow.secondary_niches ?? [],
        uniqueValueProposition:
          creatorRow.unique_value_proposition ||
          `Konten terarah di bidang ${creatorRow.primary_niche}`,
        targetAudienceSummary:
          creatorRow.target_audience_summary ||
          "Audiens digital Indonesia yang mencari panduan praktis",
        toneOfVoice:
          creatorRow.tone_of_voice && creatorRow.tone_of_voice.length > 0
            ? creatorRow.tone_of_voice
            : ["edukatif", "autentik"],
        personalityArchetype: creatorRow.personality_archetype || "The Practical Guide",
        strengths:
          creatorRow.strengths && creatorRow.strengths.length > 0
            ? creatorRow.strengths
            : ["Konsisten belajar"],
        tabooTopics: creatorRow.taboo_topics ?? [],
        primaryPlatforms:
          creatorRow.primary_platforms && creatorRow.primary_platforms.length > 0
            ? creatorRow.primary_platforms
            : ["tiktok", "instagram"],
        preferredFormats:
          creatorRow.preferred_formats && creatorRow.preferred_formats.length > 0
            ? creatorRow.preferred_formats
            : ["short_video_talking_head"],
      };

      const parsedDna = creatorDnaEditableSchema.safeParse(dnaCandidate);
      if (parsedDna.success) {
        creatorDna = parsedDna.data;
      }

      const parsedPersona = audiencePersonaSchema.safeParse(creatorRow.audience_persona);
      if (parsedPersona.success) {
        audiencePersona = parsedPersona.data;
      }

      const parsedAssessment = creatorAssessmentSchema.safeParse(
        creatorRow.assessment_scores
      );
      if (parsedAssessment.success) {
        creatorAssessment = parsedAssessment.data;
      }

      monetizationRecommendations = parseJsonArraySafely(
        creatorRow.monetization_recommendations,
        monetizationRecommendationItemSchema
      );

      roadmap30Days = parseJsonArraySafely(
        creatorRow.roadmap_30_days,
        roadmapWeekSchema
      );
    }

    const selectedNiche = selectedNicheRow ? parseNicheRow(selectedNicheRow) : null;

    // Optional Phase 3 enrichments (Brand Context + Active Strategy & Pillars)
    let brandContext: BrandProfileInput | null = null;
    let activeStrategy: ActiveStrategySummary | null = null;

    try {
      const [{ data: brandRowData }, { data: strategyRowData }] = await Promise.all([
        supabase
          .from("brand_profiles")
          .select("*")
          .eq("workspace_id", workspaceId)
          .maybeSingle(),
        supabase
          .from("content_strategies")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      const brandRow = brandRowData as BrandProfileRow | null;
      if (brandRow) {
        const parsedBrand = brandProfileInputSchema.safeParse({
          brandName: brandRow.brand_name,
          tagline: brandRow.tagline ?? "",
          positioningStatement: brandRow.positioning_statement ?? "",
          offerSummary: brandRow.offer_summary ?? "",
          brandValues: brandRow.brand_values ?? [],
          voiceGuidelines: brandRow.voice_guidelines ?? [],
        });
        if (parsedBrand.success) {
          brandContext = parsedBrand.data;
        }
      }

      const strategyRow = strategyRowData as ContentStrategyRow | null;
      if (strategyRow) {
        const { data: pillarRowsData } = await supabase
          .from("content_pillars")
          .select("*")
          .eq("strategy_id", strategyRow.id)
          .eq("workspace_id", workspaceId)
          .order("sort_order", { ascending: true });

        const pillarRows = (pillarRowsData ?? []) as ContentPillarRow[];
        activeStrategy = {
          id: strategyRow.id,
          title: strategyRow.title,
          positioningStatement: strategyRow.positioning_statement,
          uniqueDifferentiator: strategyRow.unique_differentiator,
          publishingFrequencyPerWeek: strategyRow.publishing_frequency_per_week,
          pillars: pillarRows.map((p) => ({
            id: p.id,
            name: p.name,
            objective: p.objective,
            ratioPercentage: p.ratio_percentage,
          })),
        };
      }
    } catch {
      // Gracefully tolerate pre-Phase-3 mock contexts
    }

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      creatorMode: workspace.creator_mode,
      defaultLanguage: settings?.default_language === "en" ? "en" : "id",
      defaultAiModel: normalizeSupportedAiModel(settings?.default_ai_model),
      onboardingCompleted: Boolean(
        userProfile?.onboarding_completed || creatorDna !== null
      ),
      coreAnswers,
      adaptiveQuestions,
      adaptiveAnswers,
      creatorDna,
      audiencePersona,
      creatorAssessment,
      monetizationRecommendations,
      roadmap30Days,
      selectedNiche,
      brandContext,
      activeStrategy,
    };
  });
}
