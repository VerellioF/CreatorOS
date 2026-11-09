/**
 * JSON Schemas for Gemini Structured JSON output across specialized agents.
 */

export const RESEARCHER_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    trendingHooks: { type: "array", items: { type: "string" } },
    audiencePainPoints: { type: "array", items: { type: "string" } },
    contentOpportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          demandLevel: { type: "string", enum: ["high", "medium"] },
          competitionLevel: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["topic", "demandLevel", "competitionLevel"],
      },
    },
    verifiedCitations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          excerpt: { type: "string" },
        },
        required: ["title", "url", "excerpt"],
      },
    },
  },
  required: [
    "summary",
    "trendingHooks",
    "audiencePainPoints",
    "contentOpportunities",
    "verifiedCitations",
  ],
} as const;

export const STRATEGIST_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    strategyTitle: { type: "string" },
    pillars: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          ratioPercentage: { type: "number" },
          exampleTopics: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "ratioPercentage", "exampleTopics"],
      },
    },
    weeklySchedule: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dayOfWeek: { type: "integer" },
          recommendedPillar: { type: "string" },
          format: { type: "string" },
        },
        required: ["dayOfWeek", "recommendedPillar", "format"],
      },
    },
  },
  required: ["strategyTitle", "pillars", "weeklySchedule"],
} as const;

export const IDEA_GENERATOR_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          hookAngle: {
            type: "string",
            enum: ["curiosity", "contrarian", "tutorial", "case_study", "relatable"],
          },
          hookPreview: { type: "string" },
          targetEmotion: { type: "string" },
          estimatedPotentialScore: { type: "number" },
        },
        required: [
          "title",
          "hookAngle",
          "hookPreview",
          "targetEmotion",
          "estimatedPotentialScore",
        ],
      },
    },
  },
  required: ["ideas"],
} as const;

export const SCRIPTWRITER_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    openingHook: { type: "string" },
    bodyContent: { type: "string" },
    closingCta: { type: "string" },
    caption: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    estimatedDurationSeconds: { type: "integer" },
    wordCount: { type: "integer" },
  },
  required: [
    "openingHook",
    "bodyContent",
    "closingCta",
    "caption",
    "hashtags",
    "estimatedDurationSeconds",
    "wordCount",
  ],
} as const;

export const STORYBOARD_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "integer" },
          durationSeconds: { type: "number" },
          spokenText: { type: "string" },
          visualDescription: { type: "string" },
          cameraAngle: {
            type: "string",
            enum: ["close-up", "medium-shot", "wide-shot", "pov", "screen-record"],
          },
          onScreenText: { type: "string" },
          audioCue: { type: "string" },
        },
        required: [
          "sceneNumber",
          "durationSeconds",
          "spokenText",
          "visualDescription",
          "cameraAngle",
          "onScreenText",
          "audioCue",
        ],
      },
    },
  },
  required: ["scenes"],
} as const;

export const DESIGNER_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    suggestedHeadline: { type: "string" },
    imagePrompt: { type: "string" },
    negativePrompt: { type: "string" },
    layoutGuidelines: { type: "string" },
    recommendedDimensions: {
      type: "object",
      properties: {
        width: { type: "integer" },
        height: { type: "integer" },
      },
      required: ["width", "height"],
    },
  },
  required: [
    "suggestedHeadline",
    "imagePrompt",
    "negativePrompt",
    "layoutGuidelines",
    "recommendedDimensions",
  ],
} as const;

export const ANALYST_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    performanceGrade: { type: "string", enum: ["A", "B", "C", "D"] },
    keyStrengths: { type: "array", items: { type: "string" } },
    dropOffAnalysis: { type: "string" },
    iterativeRecommendations: { type: "array", items: { type: "string" } },
  },
  required: [
    "performanceGrade",
    "keyStrengths",
    "dropOffAnalysis",
    "iterativeRecommendations",
  ],
} as const;

export const MONETIZATION_COACH_AGENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    monetizationPotentialScore: { type: "number" },
    recommendedAffiliateCategories: { type: "array", items: { type: "string" } },
    digitalProductIdeas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          format: { type: "string", enum: ["ebook", "notion_template", "mini_course"] },
          targetPriceIdr: { type: "integer" },
        },
        required: ["title", "format", "targetPriceIdr"],
      },
    },
    estimatedSponsorshipRateIdr: {
      type: "object",
      properties: {
        min: { type: "integer" },
        max: { type: "integer" },
      },
      required: ["min", "max"],
    },
  },
  required: [
    "monetizationPotentialScore",
    "recommendedAffiliateCategories",
    "digitalProductIdeas",
    "estimatedSponsorshipRateIdr",
  ],
} as const;
