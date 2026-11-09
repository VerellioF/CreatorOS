import { z } from "zod";
import { stripControlChars } from "@/lib/security/sanitize";
import { creatorModeEnum } from "@/lib/validation/workspace-schemas";

/**
 * Guardrail regex blocking promises of guaranteed income, guaranteed wealth, or guaranteed virality
 * per Phase 2 specification ("Do not promise income or virality") and AGENTS.md Rule 3.
 */
const FORBIDDEN_PROMISE_REGEX =
  /\b(dijamin\s+(?:viral|fyp)|pasti\s+(?:viral|fyp)|100%\s*(?:viral|fyp)|auto\s+(?:viral|fyp|kaya|cuan)|guaranteed\s+viral|guaranteed\s+to\s+go\s+viral|dijamin\s+(?:cuan|kaya|untung|penghasilan)|pasti\s+(?:kaya|cuan|cuan\s+jutaan|dapat\s+uang)|guaranteed\s+(?:income|earnings|profit|revenue)|cepat\s+kaya\s+instan)\b/i;

export function containsForbiddenPromise(text: string): boolean {
  return FORBIDDEN_PROMISE_REGEX.test(text);
}

const cleanShortText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => stripControlChars(v).trim())
    .pipe(
      z
        .string()
        .min(min, `${label} minimal ${min} karakter`)
        .max(max, `${label} maksimal ${max} karakter`)
    );

const antiPromiseText = (min: number, max: number, label: string) =>
  cleanShortText(min, max, label).refine(
    (val) => !containsForbiddenPromise(val),
    `${label} tidak boleh menjanjikan penghasilan pasti atau jaminan viralitas`
  );

export const experienceLevelEnum = z.enum([
  "complete_beginner",
  "inconsistent_creator",
  "consistent_creator",
  "subject_matter_expert",
]);

export const availableTimeEnum = z.enum([
  "under_3_hours_weekly",
  "3_to_6_hours_weekly",
  "7_to_14_hours_weekly",
  "15_plus_hours_weekly",
]);

export const equipmentTierEnum = z.enum([
  "smartphone_only",
  "smartphone_with_basic_audio_light",
  "camera_and_desktop_setup",
  "laptop_screen_faceless_only",
]);

export const preferredFormatEnum = z.enum([
  "short_video_talking_head",
  "short_video_faceless_broll",
  "carousel_and_microblog",
  "long_form_educational_video",
  "product_demo_and_review",
]);

export const platformIdEnum = z.enum([
  "tiktok",
  "instagram",
  "youtube",
  "linkedin",
  "threads",
  "x",
]);

export const monetizationPreferenceEnum = z.enum([
  "affiliate_commission",
  "digital_products",
  "services_and_consulting",
  "brand_sponsorships",
  "own_business_sales",
  "undecided_explore_first",
]);

/**
 * 1. Core Onboarding Answers (All 9 required user dimensions + Creator Mode)
 */
export const onboardingCoreAnswersSchema = z
  .object({
    creatorMode: creatorModeEnum,
    interests: z
      .array(cleanShortText(2, 80, "Minat"))
      .min(1, "Masukkan minimal 1 minat")
      .max(12, "Maksimal 12 minat"),
    skills: z
      .array(cleanShortText(2, 80, "Keahlian"))
      .min(1, "Masukkan minimal 1 keahlian")
      .max(12, "Maksimal 12 keahlian"),
    experience: experienceLevelEnum,
    experienceNotes: cleanShortText(0, 400, "Catatan pengalaman").default(""),
    availableTime: availableTimeEnum,
    availableEquipment: equipmentTierEnum,
    equipmentNotes: cleanShortText(0, 300, "Detail peralatan").default(""),
    preferredContentFormat: z
      .array(preferredFormatEnum)
      .min(1, "Pilih minimal 1 format konten")
      .max(5),
    primaryPlatforms: z
      .array(platformIdEnum)
      .min(1, "Pilih minimal 1 platform")
      .max(6)
      .default(["tiktok", "instagram"]),
    targetAudience: cleanShortText(5, 500, "Target audiens"),
    goals: cleanShortText(5, 500, "Tujuan kreator"),
    monetizationPreferences: z
      .array(monetizationPreferenceEnum)
      .min(1, "Pilih minimal 1 preferensi monetisasi")
      .max(6),
  })
  .strict();

export type OnboardingCoreAnswers = z.infer<typeof onboardingCoreAnswersSchema>;

/**
 * 2. Adaptive Interview Questions & Editable Answers
 */
export const adaptiveQuestionItemSchema = z
  .object({
    id: cleanShortText(2, 60, "ID pertanyaan"),
    question: antiPromiseText(10, 400, "Pertanyaan adaptif"),
    whyItMatters: antiPromiseText(5, 300, "Alasan pertanyaan"),
    targetDimension: z.enum([
      "niche_specificity",
      "audience_pain_point",
      "production_constraint",
      "differentiation",
      "monetization_fit",
    ]),
    placeholder: cleanShortText(3, 220, "Contoh jawaban"),
    options: z.array(cleanShortText(2, 120, "Opsi")).max(5).optional(),
  })
  .strict();

export type AdaptiveQuestionItem = z.infer<typeof adaptiveQuestionItemSchema>;

export const adaptiveQuestionBatchSchema = z
  .object({
    coachSummary: antiPromiseText(10, 450, "Ringkasan pelatih onboarding"),
    questions: z.array(adaptiveQuestionItemSchema).min(3).max(5),
  })
  .strict();

export type AdaptiveQuestionBatch = z.infer<typeof adaptiveQuestionBatchSchema>;

export const saveAdaptiveAnswersSchema = z
  .object({
    answers: z.record(
      cleanShortText(2, 60, "ID pertanyaan"),
      cleanShortText(1, 800, "Jawaban wawancara")
    ),
  })
  .strict();

export type SaveAdaptiveAnswersInput = z.infer<typeof saveAdaptiveAnswersSchema>;

/**
 * 3. Audience Persona Schema
 */
export const audiencePersonaSchema = z
  .object({
    personaName: cleanShortText(2, 100, "Nama persona"),
    ageRange: cleanShortText(2, 40, "Rentang usia"),
    occupationOrLifeStage: cleanShortText(3, 160, "Pekerjaan / fase hidup"),
    corePainPoints: z.array(cleanShortText(3, 200, "Pain point")).min(2).max(6),
    coreDesires: z.array(cleanShortText(3, 200, "Keinginan audiens")).min(2).max(6),
    contentConsumptionHabits: cleanShortText(5, 400, "Kebiasaan konsumsi konten"),
    commonObjections: z.array(cleanShortText(3, 200, "Keraguan audiens")).min(1).max(5),
    activePlatforms: z.array(cleanShortText(2, 40, "Platform aktif")).min(1).max(6),
  })
  .strict();

export type AudiencePersona = z.infer<typeof audiencePersonaSchema>;

/**
 * 4. Creator Assessment Schema
 */
export const creatorAssessmentDimensionSchema = z
  .object({
    dimension: cleanShortText(3, 80, "Dimensi evaluasi"),
    score: z.number().int().min(1).max(10),
    rationale: antiPromiseText(5, 300, "Rasional skor"),
  })
  .strict();

export const creatorAssessmentSchema = z
  .object({
    readinessLevel: z.enum(["foundation_building", "ready_to_launch", "ready_to_scale"]),
    summary: antiPromiseText(10, 500, "Ringkasan evaluasi kreator"),
    dimensions: z.array(creatorAssessmentDimensionSchema).min(4).max(6),
    topStrengths: z.array(cleanShortText(3, 180, "Kekuatan utama")).min(2).max(5),
    keyBottlenecks: z.array(cleanShortText(3, 200, "Hambatan utama")).min(1).max(5),
    recommendedFocus: antiPromiseText(10, 350, "Fokus prioritas"),
  })
  .strict();

export type CreatorAssessment = z.infer<typeof creatorAssessmentSchema>;

/**
 * 5. Monetization Recommendation Schema (Strictly NO income or virality promises)
 */
export const monetizationRecommendationItemSchema = z
  .object({
    pathwayName: cleanShortText(3, 120, "Jalur monetisasi"),
    modelType: monetizationPreferenceEnum,
    fitExplanation: antiPromiseText(10, 400, "Penjelasan kecocokan"),
    readinessStage: z.enum(["mulai_sekarang", "setelah_konsisten_30_hari", "jangka_menengah"]),
    prerequisites: z.array(cleanShortText(3, 180, "Prasyarat")).min(1).max(5),
    firstActionStep: antiPromiseText(5, 250, "Langkah awal konkret"),
    realisticDisclaimer: antiPromiseText(10, 300, "Catatan realistis tanpa janji penghasilan"),
  })
  .strict();

export type MonetizationRecommendationItem = z.infer<
  typeof monetizationRecommendationItemSchema
>;

/**
 * 6. 30-Day Creator Roadmap Schema
 */
export const roadmapTaskItemSchema = z
  .object({
    id: cleanShortText(2, 60, "ID tugas"),
    dayRange: cleanShortText(2, 40, "Rentang hari"),
    title: antiPromiseText(5, 160, "Judul aksi"),
    contentFormat: cleanShortText(2, 80, "Format konten"),
    actionDescription: antiPromiseText(10, 400, "Langkah eksekusi"),
    deliverableOutput: cleanShortText(3, 180, "Output terukur"),
    completed: z.boolean().default(false),
  })
  .strict();

export const roadmapWeekSchema = z
  .object({
    weekNumber: z.number().int().min(1).max(4),
    theme: cleanShortText(3, 120, "Tema minggu"),
    weeklyGoal: antiPromiseText(5, 280, "Target minggu ini"),
    postingCadence: cleanShortText(3, 100, "Frekuensi publikasi"),
    tasks: z.array(roadmapTaskItemSchema).min(2).max(5),
  })
  .strict();

export type RoadmapWeek = z.infer<typeof roadmapWeekSchema>;

/**
 * 7. Creator DNA Schema (Generated & User-Editable)
 */
export const creatorDnaEditableSchema = z
  .object({
    creatorName: cleanShortText(2, 100, "Nama kreator / brand"),
    primaryNiche: cleanShortText(2, 150, "Niche utama"),
    secondaryNiches: z.array(cleanShortText(2, 100, "Sub-niche")).max(6),
    uniqueValueProposition: antiPromiseText(10, 500, "Unique Value Proposition"),
    targetAudienceSummary: cleanShortText(10, 800, "Ringkasan target audiens"),
    toneOfVoice: z.array(cleanShortText(2, 60, "Tone of voice")).min(1).max(6),
    personalityArchetype: cleanShortText(3, 100, "Arketipe kreator"),
    strengths: z.array(cleanShortText(2, 120, "Keunggulan kreator")).min(1).max(8),
    tabooTopics: z.array(cleanShortText(2, 120, "Topik tabu / dihindari")).max(10),
    primaryPlatforms: z.array(platformIdEnum).min(1).max(6),
    preferredFormats: z.array(cleanShortText(2, 80, "Format pilihan")).min(1).max(6),
  })
  .strict();

export type CreatorDnaEditable = z.infer<typeof creatorDnaEditableSchema>;

/**
 * Full AI Synthesis Payload returned by OnboardingCoachAgent
 */
export const creatorIntelligenceSynthesisSchema = z
  .object({
    creatorDna: creatorDnaEditableSchema,
    audiencePersona: audiencePersonaSchema,
    creatorAssessment: creatorAssessmentSchema,
    monetizationRecommendations: z
      .array(monetizationRecommendationItemSchema)
      .min(2)
      .max(4),
    roadmap30Days: z.array(roadmapWeekSchema).length(4),
  })
  .strict();

export type CreatorIntelligenceSynthesis = z.infer<
  typeof creatorIntelligenceSynthesisSchema
>;

/**
 * 8. Structured Niche Discovery Recommendation Schema
 * Includes all 8 mandatory fields with strict anti-virality/income promise validation.
 */
export const nicheRecommendationCandidateSchema = z
  .object({
    nicheTitle: cleanShortText(3, 150, "Judul niche"),
    explanation: antiPromiseText(15, 1200, "Penjelasan kecocokan niche"),
    audience: cleanShortText(10, 800, "Target audiens niche"),
    contentOpportunities: z
      .array(
        z
          .object({
            angleTitle: cleanShortText(3, 140, "Sudut konten"),
            formatSuggestion: cleanShortText(3, 80, "Format"),
            whyAudienceCares: antiPromiseText(5, 280, "Alasan audiens peduli"),
          })
          .strict()
      )
      .min(3)
      .max(5),
    competitionAssessment: z
      .object({
        competitionDensity: z.enum(["low", "moderate", "high"]),
        differentiationStrategy: antiPromiseText(10, 400, "Strategi diferensiasi"),
        entryBarrierSummary: antiPromiseText(5, 300, "Hambatan masuk"),
        assessmentMethodology: cleanShortText(10, 300, "Metodologi penilaian"),
      })
      .strict(),
    requiredSkills: z.array(cleanShortText(2, 100, "Keahlian yang dibutuhkan")).min(2).max(7),
    monetizationPossibilities: z
      .array(
        z
          .object({
            channel: cleanShortText(3, 100, "Jalur monetisasi"),
            prerequisiteNote: antiPromiseText(5, 260, "Catatan prasyarat realistis"),
          })
          .strict()
      )
      .min(2)
      .max(4),
    confidenceLevel: z.enum(["high", "medium", "exploratory"]),
    confidenceScore: z.number().int().min(1).max(100),
    supportingEvidence: z
      .object({
        profileFitSignals: z.array(cleanShortText(3, 220, "Sinyal kecocokan profil")).min(2).max(5),
        marketObservationNote: antiPromiseText(10, 400, "Observasi kualitatif"),
        dataAvailabilityStatus: cleanShortText(10, 300, "Status ketersediaan bukti"),
      })
      .strict(),
  })
  .strict();

export type NicheRecommendationCandidate = z.infer<
  typeof nicheRecommendationCandidateSchema
>;

export const nicheDiscoveryBatchSchema = z
  .object({
    recommendations: z.array(nicheRecommendationCandidateSchema).min(3).max(4),
  })
  .strict();

export type NicheDiscoveryBatch = z.infer<typeof nicheDiscoveryBatchSchema>;
