import type { JsonSchemaObject } from "@/lib/ai/types";

export const RESEARCH_SYNTHESIS_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description:
    "Dossier riset berbasis bukti terverifikasi yang memisahkan fakta sumber nyata dari interpretasi strategis AI tanpa mengarang statistik.",
  properties: {
    title: { type: "string", description: "Judul laporan riset yang spesifik" },
    summary: {
      type: "string",
      description: "Ringkasan eksekutif riset secara objektif",
    },
    verifiedFacts: {
      type: "array",
      description:
        "Daftar fakta yang MURNI berasal dari sumber URL yang tercatat (kosongkan array jika tidak ada sumber eksternal terverifikasi)",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          sourceUrls: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["fact", "sourceUrls", "confidence"],
      },
    },
    aiInterpretations: {
      type: "array",
      description:
        "Analisis, hipotesis, dan interpretasi strategis AI yang dipisahkan tegas dari fakta mentah",
      items: {
        type: "object",
        properties: {
          interpretation: { type: "string" },
          reasoningBasis: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["interpretation", "reasoningBasis", "confidence"],
      },
    },
    trendClaims: {
      type: "array",
      description:
        "Klaim pola tren yang dapat ditelusuri ke URL sumber atau ditandai jujur sebagai pola kualitatif",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          directionOrPattern: { type: "string" },
          evidenceStatus: {
            type: "string",
            enum: ["verified_by_sources", "qualitative_pattern_only"],
          },
          supportingSourceUrls: {
            type: "array",
            items: { type: "string" },
          },
          confidenceLevel: { type: "string", enum: ["high", "medium", "low"] },
          dataLimitation: { type: "string" },
        },
        required: [
          "claim",
          "directionOrPattern",
          "evidenceStatus",
          "supportingSourceUrls",
          "confidenceLevel",
          "dataLimitation",
        ],
      },
    },
    audienceInsights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          segmentPainOrDesire: { type: "string" },
          contentBehaviorNote: { type: "string" },
          evidenceBasis: { type: "string" },
        },
        required: ["segmentPainOrDesire", "contentBehaviorNote", "evidenceBasis"],
      },
    },
    competitorInsights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          competitorHandleOrGroup: { type: "string" },
          observedStrength: { type: "string" },
          contentGapOpportunity: { type: "string" },
          evidenceBasis: { type: "string" },
        },
        required: [
          "competitorHandleOrGroup",
          "observedStrength",
          "contentGapOpportunity",
          "evidenceBasis",
        ],
      },
    },
    actionableRecommendations: {
      type: "array",
      items: { type: "string" },
    },
    sourceAssessments: {
      type: "array",
      description:
        "Evaluasi ekstraksi & limitasi untuk URL sumber nyata yang diberikan/ditemukan",
      items: {
        type: "object",
        properties: {
          sourceUrl: { type: "string" },
          relevantExtract: { type: "string" },
          dataLimitations: { type: "string" },
          confidenceLevel: { type: "string", enum: ["high", "medium", "low"] },
          confidenceRationale: { type: "string" },
        },
        required: [
          "sourceUrl",
          "relevantExtract",
          "dataLimitations",
          "confidenceLevel",
          "confidenceRationale",
        ],
      },
    },
    dataLimitations: {
      type: "string",
      description: "Penjelasan jujur atas keterbatasan cakupan data laporan ini",
    },
    overallConfidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
  },
  required: [
    "title",
    "summary",
    "verifiedFacts",
    "aiInterpretations",
    "trendClaims",
    "audienceInsights",
    "competitorInsights",
    "actionableRecommendations",
    "sourceAssessments",
    "dataLimitations",
    "overallConfidence",
  ],
};

export const CONTENT_STRATEGY_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description:
    "Strategi konten multi-platform mencakup positioning, matriks distribusi, opportunity scoring, dan 3-5 pilar konten.",
  properties: {
    title: { type: "string" },
    positioningStatement: { type: "string" },
    uniqueDifferentiator: { type: "string" },
    coreNarrative: { type: "string" },
    publishingFrequencyPerWeek: { type: "integer" },
    platformDistribution: {
      type: "array",
      items: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["tiktok", "instagram", "youtube", "linkedin", "threads", "x"],
          },
          roleInFunnel: { type: "string" },
          weeklyCadence: { type: "integer" },
          primaryFormat: { type: "string" },
          adaptationRule: { type: "string" },
        },
        required: [
          "platform",
          "roleInFunnel",
          "weeklyCadence",
          "primaryFormat",
          "adaptationRule",
        ],
      },
    },
    opportunityScores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicOrAngle: { type: "string" },
          targetPlatform: {
            type: "string",
            enum: ["tiktok", "instagram", "youtube", "linkedin", "threads", "x"],
          },
          demandSignal: { type: "string" },
          competitionDensity: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          creatorFitScore: { type: "integer" },
          opportunityScore: { type: "integer" },
          scoringRationale: { type: "string" },
          evidenceSourceNote: { type: "string" },
        },
        required: [
          "topicOrAngle",
          "targetPlatform",
          "demandSignal",
          "competitionDensity",
          "creatorFitScore",
          "opportunityScore",
          "scoringRationale",
          "evidenceSourceNote",
        ],
      },
    },
    pillars: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          objective: {
            type: "string",
            enum: ["educate", "trust", "engage", "convert"],
          },
          ratioPercentage: { type: "integer" },
          exampleTopics: { type: "array", items: { type: "string" } },
          recommendedFormats: { type: "array", items: { type: "string" } },
          colorCode: { type: "string" },
        },
        required: [
          "name",
          "description",
          "objective",
          "ratioPercentage",
          "exampleTopics",
          "recommendedFormats",
          "colorCode",
        ],
      },
    },
  },
  required: [
    "title",
    "positioningStatement",
    "uniqueDifferentiator",
    "coreNarrative",
    "publishingFrequencyPerWeek",
    "platformDistribution",
    "opportunityScores",
    "pillars",
  ],
};
