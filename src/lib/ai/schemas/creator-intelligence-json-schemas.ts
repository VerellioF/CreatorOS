import type { JsonSchemaObject } from "@/lib/ai/types";

export const ADAPTIVE_QUESTIONS_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description: "Daftar pertanyaan wawancara adaptif lanjutan yang disesuaikan dengan profil kreator.",
  properties: {
    coachSummary: {
      type: "string",
      description: "Ringkasan singkat observasi awal atas jawaban kreator dalam Bahasa Indonesia.",
    },
    questions: {
      type: "array",
      description: "3 hingga 4 pertanyaan lanjutan spesifik untuk memperdalam DNA kreator.",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Slug unik pertanyaan, misal q_subniche_focus" },
          question: { type: "string", description: "Pertanyaan spesifik dalam Bahasa Indonesia" },
          whyItMatters: { type: "string", description: "Alasan mengapa pertanyaan ini penting" },
          targetDimension: {
            type: "string",
            enum: [
              "niche_specificity",
              "audience_pain_point",
              "production_constraint",
              "differentiation",
              "monetization_fit",
            ],
          },
          placeholder: { type: "string", description: "Contoh jawaban singkat yang relevan" },
          options: {
            type: "array",
            description: "2 hingga 4 opsi inspirasi jawaban cepat",
            items: { type: "string" },
          },
        },
        required: ["id", "question", "whyItMatters", "targetDimension", "placeholder"],
      },
    },
  },
  required: ["coachSummary", "questions"],
};

export const CREATOR_INTELLIGENCE_SYNTHESIS_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description:
    "Sintesis lengkap Creator DNA, Audience Persona, Creator Assessment, Monetization Recommendations, dan 30-Day Creator Roadmap.",
  properties: {
    creatorDna: {
      type: "object",
      properties: {
        creatorName: { type: "string" },
        primaryNiche: { type: "string" },
        secondaryNiches: { type: "array", items: { type: "string" } },
        uniqueValueProposition: { type: "string" },
        targetAudienceSummary: { type: "string" },
        toneOfVoice: { type: "array", items: { type: "string" } },
        personalityArchetype: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        tabooTopics: { type: "array", items: { type: "string" } },
        primaryPlatforms: {
          type: "array",
          items: {
            type: "string",
            enum: ["tiktok", "instagram", "youtube", "linkedin", "threads", "x"],
          },
        },
        preferredFormats: { type: "array", items: { type: "string" } },
      },
      required: [
        "creatorName",
        "primaryNiche",
        "secondaryNiches",
        "uniqueValueProposition",
        "targetAudienceSummary",
        "toneOfVoice",
        "personalityArchetype",
        "strengths",
        "tabooTopics",
        "primaryPlatforms",
        "preferredFormats",
      ],
    },
    audiencePersona: {
      type: "object",
      properties: {
        personaName: { type: "string" },
        ageRange: { type: "string" },
        occupationOrLifeStage: { type: "string" },
        corePainPoints: { type: "array", items: { type: "string" } },
        coreDesires: { type: "array", items: { type: "string" } },
        contentConsumptionHabits: { type: "string" },
        commonObjections: { type: "array", items: { type: "string" } },
        activePlatforms: { type: "array", items: { type: "string" } },
      },
      required: [
        "personaName",
        "ageRange",
        "occupationOrLifeStage",
        "corePainPoints",
        "coreDesires",
        "contentConsumptionHabits",
        "commonObjections",
        "activePlatforms",
      ],
    },
    creatorAssessment: {
      type: "object",
      properties: {
        readinessLevel: {
          type: "string",
          enum: ["foundation_building", "ready_to_launch", "ready_to_scale"],
        },
        summary: { type: "string" },
        dimensions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dimension: { type: "string" },
              score: { type: "integer" },
              rationale: { type: "string" },
            },
            required: ["dimension", "score", "rationale"],
          },
        },
        topStrengths: { type: "array", items: { type: "string" } },
        keyBottlenecks: { type: "array", items: { type: "string" } },
        recommendedFocus: { type: "string" },
      },
      required: [
        "readinessLevel",
        "summary",
        "dimensions",
        "topStrengths",
        "keyBottlenecks",
        "recommendedFocus",
      ],
    },
    monetizationRecommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pathwayName: { type: "string" },
          modelType: {
            type: "string",
            enum: [
              "affiliate_commission",
              "digital_products",
              "services_and_consulting",
              "brand_sponsorships",
              "own_business_sales",
              "undecided_explore_first",
            ],
          },
          fitExplanation: { type: "string" },
          readinessStage: {
            type: "string",
            enum: ["mulai_sekarang", "setelah_konsisten_30_hari", "jangka_menengah"],
          },
          prerequisites: { type: "array", items: { type: "string" } },
          firstActionStep: { type: "string" },
          realisticDisclaimer: { type: "string" },
        },
        required: [
          "pathwayName",
          "modelType",
          "fitExplanation",
          "readinessStage",
          "prerequisites",
          "firstActionStep",
          "realisticDisclaimer",
        ],
      },
    },
    roadmap30Days: {
      type: "array",
      description: "Rencana kerja 4 minggu (Minggu 1 s.d. Minggu 4).",
      items: {
        type: "object",
        properties: {
          weekNumber: { type: "integer" },
          theme: { type: "string" },
          weeklyGoal: { type: "string" },
          postingCadence: { type: "string" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                dayRange: { type: "string" },
                title: { type: "string" },
                contentFormat: { type: "string" },
                actionDescription: { type: "string" },
                deliverableOutput: { type: "string" },
                completed: { type: "boolean" },
              },
              required: [
                "id",
                "dayRange",
                "title",
                "contentFormat",
                "actionDescription",
                "deliverableOutput",
                "completed",
              ],
            },
          },
        },
        required: ["weekNumber", "theme", "weeklyGoal", "postingCadence", "tasks"],
      },
    },
  },
  required: [
    "creatorDna",
    "audiencePersona",
    "creatorAssessment",
    "monetizationRecommendations",
    "roadmap30Days",
  ],
};

export const NICHE_DISCOVERY_JSON_SCHEMA: JsonSchemaObject = {
  type: "object",
  description: "Daftar 3 sampai 4 rekomendasi niche terstruktur beserta evaluasi realistis.",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nicheTitle: { type: "string" },
          explanation: { type: "string" },
          audience: { type: "string" },
          contentOpportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                angleTitle: { type: "string" },
                formatSuggestion: { type: "string" },
                whyAudienceCares: { type: "string" },
              },
              required: ["angleTitle", "formatSuggestion", "whyAudienceCares"],
            },
          },
          competitionAssessment: {
            type: "object",
            properties: {
              competitionDensity: {
                type: "string",
                enum: ["low", "moderate", "high"],
              },
              differentiationStrategy: { type: "string" },
              entryBarrierSummary: { type: "string" },
              assessmentMethodology: { type: "string" },
            },
            required: [
              "competitionDensity",
              "differentiationStrategy",
              "entryBarrierSummary",
              "assessmentMethodology",
            ],
          },
          requiredSkills: {
            type: "array",
            items: { type: "string" },
          },
          monetizationPossibilities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                channel: { type: "string" },
                prerequisiteNote: { type: "string" },
              },
              required: ["channel", "prerequisiteNote"],
            },
          },
          confidenceLevel: {
            type: "string",
            enum: ["high", "medium", "exploratory"],
          },
          confidenceScore: { type: "integer" },
          supportingEvidence: {
            type: "object",
            properties: {
              profileFitSignals: {
                type: "array",
                items: { type: "string" },
              },
              marketObservationNote: { type: "string" },
              dataAvailabilityStatus: { type: "string" },
            },
            required: [
              "profileFitSignals",
              "marketObservationNote",
              "dataAvailabilityStatus",
            ],
          },
        },
        required: [
          "nicheTitle",
          "explanation",
          "audience",
          "contentOpportunities",
          "competitionAssessment",
          "requiredSkills",
          "monetizationPossibilities",
          "confidenceLevel",
          "confidenceScore",
          "supportingEvidence",
        ],
      },
    },
  },
  required: ["recommendations"],
};
