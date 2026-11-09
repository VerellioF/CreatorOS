import { z } from "zod";
import { stripControlChars } from "@/lib/security/sanitize";
import {
  containsForbiddenPromise,
  platformIdEnum,
} from "@/lib/validation/creator-intelligence-schemas";
import { isSafePublicHttpUrl } from "@/lib/research/web-evidence-collector";
import { uuidSchema } from "@/lib/validation/workspace-schemas";

const cleanText = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => stripControlChars(v).trim())
    .pipe(
      z
        .string()
        .min(min, `${label} minimal ${min} karakter`)
        .max(max, `${label} maksimal ${max} karakter`)
    );

const safeResearchText = (min: number, max: number, label: string) =>
  cleanText(min, max, label).refine(
    (v) => !containsForbiddenPromise(v),
    `${label} tidak boleh memuat janji penghasilan pasti atau jaminan viralitas`
  );

export const researchReportTypeEnum = z.enum(["trend", "competitor", "audience"]);
export const researchConfidenceEnum = z.enum(["high", "medium", "low"]);
export const researchSourceOriginEnum = z.enum([
  "web_grounding",
  "rss_feed",
  "user_url",
  "competitor_evidence",
]);

export const safeHttpUrlSchema = z
  .string()
  .transform((v) => stripControlChars(v).trim())
  .refine(
    (v) => v.length <= 2048 && isSafePublicHttpUrl(v),
    "URL sumber harus berupa tautan publik http:// atau https:// yang valid"
  );

/**
 * Mandatory recorded research source contract:
 * Source URL, Source title, Retrieval timestamp, Relevant extracted info,
 * Data limitations, Confidence assessment.
 */
export const researchSourceRecordSchema = z
  .object({
    sourceUrl: safeHttpUrlSchema,
    sourceTitle: cleanText(2, 300, "Judul sumber"),
    retrievedAt: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), "Timestamp pengambilan sumber tidak valid"),
    relevantExtract: safeResearchText(5, 2500, "Informasi terekstrak"),
    dataLimitations: safeResearchText(5, 1200, "Keterbatasan data sumber"),
    confidenceLevel: researchConfidenceEnum,
    confidenceRationale: safeResearchText(5, 800, "Penilaian keyakinan sumber"),
    sourceOrigin: researchSourceOriginEnum.default("web_grounding"),
  })
  .strict();

export type ResearchSourceRecord = z.infer<typeof researchSourceRecordSchema>;

export const verifiedFactItemSchema = z
  .object({
    fact: safeResearchText(8, 700, "Fakta terverifikasi"),
    sourceUrls: z.array(safeHttpUrlSchema).min(1).max(6),
    confidence: researchConfidenceEnum,
  })
  .strict();

export type VerifiedFactItem = z.infer<typeof verifiedFactItemSchema>;

export const aiInterpretationItemSchema = z
  .object({
    interpretation: safeResearchText(10, 700, "Interpretasi strategis AI"),
    reasoningBasis: safeResearchText(5, 500, "Dasar penalaran"),
    confidence: researchConfidenceEnum,
  })
  .strict();

export type AiInterpretationItem = z.infer<typeof aiInterpretationItemSchema>;

export const traceableTrendClaimSchema = z
  .object({
    claim: safeResearchText(8, 450, "Klaim tren"),
    directionOrPattern: safeResearchText(5, 350, "Pola / arah perubahan"),
    evidenceStatus: z.enum(["verified_by_sources", "qualitative_pattern_only"]),
    supportingSourceUrls: z.array(safeHttpUrlSchema).max(6),
    confidenceLevel: researchConfidenceEnum,
    dataLimitation: safeResearchText(5, 450, "Batasan bukti klaim"),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (
      val.evidenceStatus === "verified_by_sources" &&
      val.supportingSourceUrls.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supportingSourceUrls"],
        message:
          "Klaim tren dengan status verified_by_sources wajib menyertakan minimal 1 URL sumber.",
      });
    }
  });

export type TraceableTrendClaim = z.infer<typeof traceableTrendClaimSchema>;

export const audienceInsightItemSchema = z
  .object({
    segmentPainOrDesire: safeResearchText(5, 350, "Kebutuhan / masalah audiens"),
    contentBehaviorNote: safeResearchText(5, 400, "Perilaku konsumsi konten"),
    evidenceBasis: safeResearchText(5, 350, "Dasar bukti"),
  })
  .strict();

export type AudienceInsightItem = z.infer<typeof audienceInsightItemSchema>;

export const competitorInsightItemSchema = z
  .object({
    competitorHandleOrGroup: cleanText(2, 120, "Kompetitor / kelompok akun"),
    observedStrength: safeResearchText(5, 400, "Kekuatan yang teramati"),
    contentGapOpportunity: safeResearchText(5, 400, "Celah diferensiasi konten"),
    evidenceBasis: safeResearchText(5, 350, "Bukti pendukung"),
  })
  .strict();

export type CompetitorInsightItem = z.infer<typeof competitorInsightItemSchema>;

/**
 * Structured AI output schema for Research Synthesis.
 * Notice: AI cites URLs from the verified candidate pool (`citedSources`),
 * and `ResearchService` filters out any URL not in the verified pool!
 */
export const aiResearchSynthesisOutputSchema = z
  .object({
    title: safeResearchText(5, 180, "Judul laporan riset"),
    summary: safeResearchText(20, 2500, "Ringkasan laporan"),
    verifiedFacts: z.array(verifiedFactItemSchema).max(8),
    aiInterpretations: z.array(aiInterpretationItemSchema).min(2).max(6),
    trendClaims: z.array(traceableTrendClaimSchema).min(1).max(6),
    audienceInsights: z.array(audienceInsightItemSchema).min(1).max(5),
    competitorInsights: z.array(competitorInsightItemSchema).max(5),
    actionableRecommendations: z
      .array(safeResearchText(8, 350, "Rekomendasi taktis"))
      .min(2)
      .max(6),
    sourceAssessments: z
      .array(
        z
          .object({
            sourceUrl: safeHttpUrlSchema,
            relevantExtract: safeResearchText(5, 900, "Ekstraksi informasi relevan"),
            dataLimitations: safeResearchText(5, 500, "Batasan sumber"),
            confidenceLevel: researchConfidenceEnum,
            confidenceRationale: safeResearchText(5, 400, "Rasional keyakinan"),
          })
          .strict()
      )
      .max(10),
    dataLimitations: safeResearchText(10, 1200, "Keterbatasan data laporan"),
    overallConfidence: researchConfidenceEnum,
  })
  .strict();

export type AiResearchSynthesisOutput = z.infer<typeof aiResearchSynthesisOutputSchema>;

export const competitorObservedHookSchema = z
  .object({
    hookText: cleanText(3, 350, "Teks hook kompetitor"),
    formatNote: cleanText(2, 180, "Format konten").default("Video pendek"),
    sourcePostUrl: safeHttpUrlSchema.optional(),
  })
  .strict();

export type CompetitorObservedHook = z.infer<typeof competitorObservedHookSchema>;

export const competitorProfileInputSchema = z
  .object({
    id: uuidSchema.optional(),
    handle: cleanText(2, 100, "Handle akun kompetitor"),
    displayName: cleanText(0, 120, "Nama tampilan").default(""),
    platform: platformIdEnum,
    profileUrl: z
      .union([safeHttpUrlSchema, z.literal("")])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    followerCountEstimate: z
      .number()
      .int()
      .min(0)
      .max(2_000_000_000)
      .nullable()
      .optional()
      .default(null),
    positioningSummary: safeResearchText(0, 800, "Ringkasan positioning").default(""),
    observedHooks: z.array(competitorObservedHookSchema).max(12).default([]),
    topPerformingTopics: z
      .array(cleanText(2, 120, "Topik unggulan"))
      .max(12)
      .default([]),
    contentGaps: z.array(cleanText(2, 180, "Celah konten")).max(10).default([]),
    evidenceNotes: safeResearchText(0, 1200, "Catatan bukti pengamatan").default(""),
    dataLimitations: safeResearchText(
      5,
      600,
      "Keterbatasan data kompetitor"
    ).default(
      "Berdasarkan pengamatan profil publik; metrik retensi internal akun tidak tersedia."
    ),
  })
  .strict();

export type CompetitorProfileInput = z.infer<typeof competitorProfileInputSchema>;

export const generateResearchRequestSchema = z
  .object({
    reportType: researchReportTypeEnum,
    topicQuery: cleanText(3, 240, "Topik atau kueri riset"),
    targetPlatform: platformIdEnum.default("tiktok"),
    referenceUrls: z.array(safeHttpUrlSchema).max(5).default([]),
    competitorIds: z.array(uuidSchema).max(8).default([]),
  })
  .strict();

export type GenerateResearchRequest = z.infer<typeof generateResearchRequestSchema>;
