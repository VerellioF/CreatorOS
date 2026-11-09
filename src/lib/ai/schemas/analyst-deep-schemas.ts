import { z } from "zod";
import type { JsonSchemaObject } from "@/lib/ai/types";

export const traceableEvidenceSchema = z.object({
  contentId: z.string(),
  contentTitle: z.string(),
  metricObserved: z.string(),
  benchmarkComparison: z.string(),
});

export type TraceableEvidence = z.infer<typeof traceableEvidenceSchema>;

export const traceableRecommendationSchema = z.object({
  id: z.string(),
  action: z.string(),
  category: z.enum(["hook", "pacing", "cta", "format", "timing", "topic"]),
  explanation: z.string(),
  evidence: z.array(traceableEvidenceSchema),
  expectedImpact: z.string(),
  applicablePillars: z.array(z.string()),
});

export type TraceableRecommendation = z.infer<typeof traceableRecommendationSchema>;

export const contentPatternInsightSchema = z.object({
  pattern: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.string(),
  samplePostTitles: z.array(z.string()),
});

export type ContentPatternInsight = z.infer<typeof contentPatternInsightSchema>;

export const audienceResponseInsightSchema = z.object({
  engagementDepth: z.string(),
  viralPotentialRatio: z.number(),
  retentionSummary: z.string(),
  sentimentThemes: z.array(z.string()),
});

export type AudienceResponseInsight = z.infer<typeof audienceResponseInsightSchema>;

export const strategyAlignmentInsightSchema = z.object({
  overallAlignmentScore: z.number().min(0).max(100),
  pillarCoverage: z.array(
    z.object({
      pillarName: z.string(),
      postCount: z.number(),
      percentage: z.number(),
      status: z.enum(["optimal", "under_represented", "over_represented"]),
    })
  ),
  misalignmentIssues: z.array(z.string()),
});

export type StrategyAlignmentInsight = z.infer<typeof strategyAlignmentInsightSchema>;

export const aiDiagnosticReportSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  performanceGrade: z.enum(["A", "B", "C", "D", "F"]),
  executiveSummary: z.string(),
  topPerformers: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      views: z.number(),
      engagementRate: z.number(),
      reasonForSuccess: z.string(),
    })
  ),
  weakPerformers: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      views: z.number(),
      engagementRate: z.number(),
      diagnosticReason: z.string(),
    })
  ),
  contentPatterns: z.array(contentPatternInsightSchema),
  audienceResponse: audienceResponseInsightSchema,
  strategyAlignment: strategyAlignmentInsightSchema,
  recommendations: z.array(traceableRecommendationSchema),
  modelId: z.string().default("gemini-1.5-flash"),
  tokensUsed: z.number().default(0),
  costUsd: z.number().default(0),
  generatedAt: z.string(),
});

export type AIDiagnosticReport = z.infer<typeof aiDiagnosticReportSchema>;

export const aiAnalystSynthesisOutputSchema = z.object({
  executiveSummary: z.string(),
  contentPatterns: z.array(contentPatternInsightSchema),
  audienceResponse: audienceResponseInsightSchema,
  recommendations: z.array(traceableRecommendationSchema),
});

export type AIAnalystSynthesisOutput = z.infer<typeof aiAnalystSynthesisOutputSchema>;

export const ANALYST_DIAGNOSTICS_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description:
    "Laporan sintesis diagnostik performa konten dengan rekomendasi taktis terverifikasi dan pola audiens.",
  properties: {
    executiveSummary: {
      type: "string",
      description: "Ringkasan eksekutif analisis performa konten periode ini",
    },
    contentPatterns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          evidence: { type: "string" },
          samplePostTitles: { type: "array", items: { type: "string" } },
        },
        required: ["pattern", "confidence", "evidence", "samplePostTitles"],
      },
    },
    audienceResponse: {
      type: "object",
      properties: {
        engagementDepth: { type: "string" },
        viralPotentialRatio: { type: "number" },
        retentionSummary: { type: "string" },
        sentimentThemes: { type: "array", items: { type: "string" } },
      },
      required: [
        "engagementDepth",
        "viralPotentialRatio",
        "retentionSummary",
        "sentimentThemes",
      ],
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          action: { type: "string" },
          category: {
            type: "string",
            enum: ["hook", "pacing", "cta", "format", "timing", "topic"],
          },
          explanation: { type: "string" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                contentId: { type: "string" },
                contentTitle: { type: "string" },
                metricObserved: { type: "string" },
                benchmarkComparison: { type: "string" },
              },
              required: [
                "contentId",
                "contentTitle",
                "metricObserved",
                "benchmarkComparison",
              ],
            },
          },
          expectedImpact: { type: "string" },
          applicablePillars: { type: "array", items: { type: "string" } },
        },
        required: [
          "id",
          "action",
          "category",
          "explanation",
          "evidence",
          "expectedImpact",
          "applicablePillars",
        ],
      },
    },
  },
  required: [
    "executiveSummary",
    "contentPatterns",
    "audienceResponse",
    "recommendations",
  ],
};
