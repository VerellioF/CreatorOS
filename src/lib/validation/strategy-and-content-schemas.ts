import { z } from "zod";
import { stripControlChars } from "@/lib/security/sanitize";
import {
  containsForbiddenPromise,
  platformIdEnum,
} from "@/lib/validation/creator-intelligence-schemas";
import { uuidSchema } from "@/lib/validation/workspace-schemas";

const cleanField = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => stripControlChars(v).trim())
    .pipe(
      z
        .string()
        .min(min, `${label} minimal ${min} karakter`)
        .max(max, `${label} maksimal ${max} karakter`)
    );

const antiHypeField = (min: number, max: number, label: string) =>
  cleanField(min, max, label).refine(
    (v) => !containsForbiddenPromise(v),
    `${label} tidak boleh menjanjikan penghasilan pasti atau jaminan viralitas`
  );

export const pillarObjectiveEnum = z.enum(["educate", "trust", "engage", "convert"]);
export const contentIdeaAngleEnum = z.enum([
  "curiosity",
  "contrarian",
  "tutorial",
  "case_study",
  "story",
  "myth_busting",
]);
export const contentIdeaStatusEnum = z.enum([
  "backlog",
  "shortlisted",
  "in_production",
  "completed",
  "archived",
]);
export const contentItemStageEnum = z.enum([
  "draft",
  "scripting",
  "ready_for_production",
  "ready_to_publish",
  "published",
  "archived",
]);
export const scriptFrameworkEnum = z.enum(["AIDA", "PAS", "BAB", "Story", "Listicle"]);

/**
 * 1. Brand Context / Positioning Schema
 */
export const brandProfileInputSchema = z
  .object({
    brandName: cleanField(2, 120, "Nama brand / identitas"),
    tagline: antiHypeField(0, 240, "Tagline").default(""),
    positioningStatement: antiHypeField(0, 1200, "Pernyataan positioning").default(""),
    offerSummary: antiHypeField(0, 1200, "Ringkasan produk/layanan").default(""),
    brandValues: z.array(cleanField(2, 80, "Nilai brand")).max(10).default([]),
    voiceGuidelines: z
      .array(cleanField(2, 160, "Panduan gaya komunikasi"))
      .max(10)
      .default([]),
  })
  .strict();

export type BrandProfileInput = z.infer<typeof brandProfileInputSchema>;

/**
 * 2. Content Strategy, Opportunity Scoring & Editable Content Pillars
 */
export const opportunityScoreItemSchema = z
  .object({
    topicOrAngle: antiHypeField(3, 180, "Topik peluang"),
    targetPlatform: platformIdEnum,
    demandSignal: antiHypeField(5, 300, "Sinyal kebutuhan audiens"),
    competitionDensity: z.enum(["low", "medium", "high"]),
    creatorFitScore: z.number().int().min(1).max(100),
    opportunityScore: z.number().int().min(1).max(100),
    scoringRationale: antiHypeField(8, 450, "Rasional skor peluang"),
    evidenceSourceNote: antiHypeField(5, 300, "Catatan rujukan bukti"),
  })
  .strict();

export type OpportunityScoreItem = z.infer<typeof opportunityScoreItemSchema>;

export const platformDistributionItemSchema = z
  .object({
    platform: platformIdEnum,
    roleInFunnel: cleanField(3, 140, "Peran di funnel"),
    weeklyCadence: z.number().int().min(1).max(14),
    primaryFormat: cleanField(3, 120, "Format utama"),
    adaptationRule: antiHypeField(5, 300, "Aturan distribusi platform"),
  })
  .strict();

export type PlatformDistributionItem = z.infer<typeof platformDistributionItemSchema>;

export const contentPillarItemSchema = z
  .object({
    name: cleanField(2, 120, "Nama pilar konten"),
    description: antiHypeField(5, 800, "Deskripsi pilar"),
    objective: pillarObjectiveEnum,
    ratioPercentage: z.number().int().min(5).max(100),
    exampleTopics: z.array(cleanField(3, 160, "Contoh topik")).min(2).max(6),
    recommendedFormats: z.array(cleanField(2, 100, "Format rekomendasi")).min(1).max(5),
    colorCode: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Kode warna harus format hex #RRGGBB")
      .default("#4F46E5"),
  })
  .strict();

export type ContentPillarItem = z.infer<typeof contentPillarItemSchema>;

export const contentPillarEditableSchema = contentPillarItemSchema
  .extend({
    id: uuidSchema.optional(),
    strategyId: uuidSchema,
    sortOrder: z.number().int().min(0).max(50).default(0),
  })
  .strict();

export type ContentPillarEditableInput = z.infer<typeof contentPillarEditableSchema>;

export const aiContentStrategyOutputSchema = z
  .object({
    title: antiHypeField(5, 160, "Judul strategi konten"),
    positioningStatement: antiHypeField(12, 1200, "Content positioning"),
    uniqueDifferentiator: antiHypeField(8, 600, "Diferensiasi utama"),
    coreNarrative: antiHypeField(10, 900, "Narasi inti konten"),
    publishingFrequencyPerWeek: z.number().int().min(1).max(21),
    platformDistribution: z.array(platformDistributionItemSchema).min(1).max(5),
    opportunityScores: z.array(opportunityScoreItemSchema).min(3).max(6),
    pillars: z.array(contentPillarItemSchema).min(3).max(5),
  })
  .strict();

export type AiContentStrategyOutput = z.infer<typeof aiContentStrategyOutputSchema>;

export const updateStrategyOverviewSchema = z
  .object({
    strategyId: uuidSchema,
    title: antiHypeField(5, 160, "Judul strategi konten"),
    positioningStatement: antiHypeField(12, 1200, "Content positioning"),
    uniqueDifferentiator: antiHypeField(5, 600, "Diferensiasi utama"),
    coreNarrative: antiHypeField(5, 900, "Narasi inti"),
    publishingFrequencyPerWeek: z.number().int().min(1).max(21),
  })
  .strict();

export type UpdateStrategyOverviewInput = z.infer<typeof updateStrategyOverviewSchema>;

/**
 * 3. Idea Generator Schemas
 */
export const aiGeneratedIdeaSchema = z
  .object({
    title: antiHypeField(5, 200, "Judul ide konten"),
    hookConcept: antiHypeField(8, 500, "Konsep hook pembuka"),
    angleType: contentIdeaAngleEnum,
    targetPlatform: platformIdEnum,
    opportunityScore: z.number().int().min(1).max(100),
    opportunityRationale: antiHypeField(8, 450, "Rasional peluang ide"),
    researchTrace: antiHypeField(5, 400, "Keterkaitan riset / persona"),
    suggestedPillarName: cleanField(2, 120, "Saran pilar konten"),
  })
  .strict();

export const aiIdeaBatchOutputSchema = z
  .object({
    batchSummary: antiHypeField(10, 450, "Ringkasan batch ide"),
    ideas: z.array(aiGeneratedIdeaSchema).min(4).max(10),
  })
  .strict();

export type AiIdeaBatchOutput = z.infer<typeof aiIdeaBatchOutputSchema>;

export const saveContentIdeaSchema = z
  .object({
    id: uuidSchema.optional(),
    pillarId: uuidSchema.nullable().optional().default(null),
    researchReportId: uuidSchema.nullable().optional().default(null),
    title: antiHypeField(5, 200, "Judul ide konten"),
    hookConcept: antiHypeField(5, 500, "Konsep hook"),
    angleType: contentIdeaAngleEnum,
    targetPlatform: platformIdEnum,
    opportunityScore: z.number().int().min(1).max(100).default(75),
    opportunityRationale: antiHypeField(0, 450, "Rasional peluang").default(""),
    researchTrace: antiHypeField(0, 400, "Jejak riset").default(""),
    status: contentIdeaStatusEnum.default("backlog"),
  })
  .strict();

export type SaveContentIdeaInput = z.infer<typeof saveContentIdeaSchema>;

/**
 * 4. Content Package (Hooks, Script, Caption, CTA, Hashtags & Platform Adaptation)
 */
export const hookVariantItemSchema = z
  .object({
    style: cleanField(2, 80, "Gaya psikologi hook"),
    hookText: antiHypeField(5, 400, "Kalimat hook"),
    visualCue: cleanField(3, 240, "Arahan visual 3 detik awal"),
  })
  .strict();

export type HookVariantItem = z.infer<typeof hookVariantItemSchema>;

export const scriptCueItemSchema = z
  .object({
    beatLabel: cleanField(2, 80, "Bagian segmen"),
    spokenSummary: antiHypeField(5, 400, "Inti kalimat / narasi"),
    visualDirection: cleanField(3, 260, "Arahan visual"),
    onScreenTextOrAudio: cleanField(2, 200, "Teks layar / audio cue"),
  })
  .strict();

export type ScriptCueItem = z.infer<typeof scriptCueItemSchema>;

export const hashtagTierSetSchema = z
  .object({
    broad: z.array(cleanField(2, 60, "Hashtag broad")).max(6),
    niche: z.array(cleanField(2, 60, "Hashtag niche")).max(6),
    specific: z.array(cleanField(2, 60, "Hashtag spesifik")).max(6),
  })
  .strict();

export type HashtagTierSet = z.infer<typeof hashtagTierSetSchema>;

export const aiContentPackageOutputSchema = z
  .object({
    title: antiHypeField(5, 200, "Judul konten"),
    contentFormat: cleanField(3, 50, "Format konten"),
    framework: scriptFrameworkEnum,
    openingHook: antiHypeField(5, 600, "Hook utama"),
    hookVariants: z.array(hookVariantItemSchema).min(3).max(5),
    bodyContent: antiHypeField(25, 12000, "Isi skrip lengkap"),
    closingCta: antiHypeField(5, 500, "CTA penutup"),
    ctaVariants: z.array(antiHypeField(5, 300, "Variasi CTA")).min(2).max(4),
    visualAndAudioCues: z.array(scriptCueItemSchema).min(2).max(8),
    estimatedDurationSeconds: z.number().int().min(10).max(3600),
    caption: antiHypeField(10, 4000, "Caption platform"),
    hashtags: z.array(cleanField(2, 60, "Hashtag")).max(15),
    hashtagTiers: hashtagTierSetSchema,
    platformAdaptationNotes: antiHypeField(8, 600, "Catatan optimasi platform"),
  })
  .strict();

export type AiContentPackageOutput = z.infer<typeof aiContentPackageOutputSchema>;

export const generateContentPackageRequestSchema = z
  .object({
    topicOrBrief: cleanField(5, 600, "Topik atau brief konten"),
    targetPlatform: platformIdEnum,
    framework: scriptFrameworkEnum.default("PAS"),
    targetDurationSeconds: z.number().int().min(15).max(1800).default(45),
    pillarId: uuidSchema.nullable().optional().default(null),
    ideaId: uuidSchema.nullable().optional().default(null),
    researchReportId: uuidSchema.nullable().optional().default(null),
  })
  .strict();

export type GenerateContentPackageRequest = z.infer<
  typeof generateContentPackageRequestSchema
>;

export const adaptContentPlatformRequestSchema = z
  .object({
    sourceContentItemId: uuidSchema,
    targetPlatform: platformIdEnum,
    targetFramework: scriptFrameworkEnum.optional(),
  })
  .strict();

export type AdaptContentPlatformRequest = z.infer<
  typeof adaptContentPlatformRequestSchema
>;

export const saveEditableContentPackageSchema = z
  .object({
    contentItemId: uuidSchema.optional(),
    scriptId: uuidSchema.optional(),
    pillarId: uuidSchema.nullable().optional().default(null),
    ideaId: uuidSchema.nullable().optional().default(null),
    researchReportId: uuidSchema.nullable().optional().default(null),
    title: antiHypeField(3, 200, "Judul konten"),
    primaryPlatform: platformIdEnum,
    contentFormat: cleanField(2, 50, "Format konten").default("short_video"),
    stage: contentItemStageEnum.default("scripting"),
    framework: scriptFrameworkEnum.default("PAS"),
    openingHook: antiHypeField(3, 1000, "Hook utama"),
    hookVariants: z.array(hookVariantItemSchema).max(8).default([]),
    bodyContent: antiHypeField(10, 14000, "Isi skrip"),
    closingCta: antiHypeField(3, 900, "CTA penutup"),
    ctaVariants: z.array(antiHypeField(3, 350, "Variasi CTA")).max(6).default([]),
    visualAndAudioCues: z.array(scriptCueItemSchema).max(12).default([]),
    estimatedDurationSeconds: z.number().int().min(5).max(3600).default(45),
    caption: antiHypeField(0, 4500, "Caption").default(""),
    hashtags: z.array(cleanField(2, 60, "Hashtag")).max(20).default([]),
    platformAdaptationNotes: antiHypeField(0, 800, "Catatan platform").default(""),
    saveAsNewScriptVersion: z.boolean().default(false),
  })
  .strict();

export type SaveEditableContentPackageInput = z.infer<
  typeof saveEditableContentPackageSchema
>;
