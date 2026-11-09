import type { JsonSchemaObject } from "@/lib/ai/types";

export const IDEA_GENERATION_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description:
    "Daftar ide konten spesifik platform yang selaras dengan Creator DNA, Brand Context, Pilar Konten, dan temuan riset.",
  properties: {
    batchSummary: { type: "string" },
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hookConcept: { type: "string" },
          angleType: {
            type: "string",
            enum: [
              "curiosity",
              "contrarian",
              "tutorial",
              "case_study",
              "story",
              "myth_busting",
            ],
          },
          targetPlatform: {
            type: "string",
            enum: ["tiktok", "instagram", "youtube", "linkedin", "threads", "x"],
          },
          opportunityScore: { type: "integer" },
          opportunityRationale: { type: "string" },
          researchTrace: { type: "string" },
          suggestedPillarName: { type: "string" },
        },
        required: [
          "title",
          "hookConcept",
          "angleType",
          "targetPlatform",
          "opportunityScore",
          "opportunityRationale",
          "researchTrace",
          "suggestedPillarName",
        ],
      },
    },
  },
  required: ["batchSummary", "ideas"],
};

export const CONTENT_PACKAGE_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description:
    "Paket konten lengkap spesifik platform meliputi multi-hook, skrip berkerangka, cue visual/audio, caption, variasi CTA, dan hashtag berjenjang.",
  properties: {
    title: { type: "string" },
    contentFormat: { type: "string" },
    framework: {
      type: "string",
      enum: ["AIDA", "PAS", "BAB", "Story", "Listicle"],
    },
    openingHook: { type: "string" },
    hookVariants: {
      type: "array",
      items: {
        type: "object",
        properties: {
          style: { type: "string" },
          hookText: { type: "string" },
          visualCue: { type: "string" },
        },
        required: ["style", "hookText", "visualCue"],
      },
    },
    bodyContent: { type: "string" },
    closingCta: { type: "string" },
    ctaVariants: {
      type: "array",
      items: { type: "string" },
    },
    visualAndAudioCues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beatLabel: { type: "string" },
          spokenSummary: { type: "string" },
          visualDirection: { type: "string" },
          onScreenTextOrAudio: { type: "string" },
        },
        required: [
          "beatLabel",
          "spokenSummary",
          "visualDirection",
          "onScreenTextOrAudio",
        ],
      },
    },
    estimatedDurationSeconds: { type: "integer" },
    caption: { type: "string" },
    hashtags: {
      type: "array",
      items: { type: "string" },
    },
    hashtagTiers: {
      type: "object",
      properties: {
        broad: { type: "array", items: { type: "string" } },
        niche: { type: "array", items: { type: "string" } },
        specific: { type: "array", items: { type: "string" } },
      },
      required: ["broad", "niche", "specific"],
    },
    platformAdaptationNotes: { type: "string" },
  },
  required: [
    "title",
    "contentFormat",
    "framework",
    "openingHook",
    "hookVariants",
    "bodyContent",
    "closingCta",
    "ctaVariants",
    "visualAndAudioCues",
    "estimatedDurationSeconds",
    "caption",
    "hashtags",
    "hashtagTiers",
    "platformAdaptationNotes",
  ],
};
