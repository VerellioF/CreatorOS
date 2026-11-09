import { z } from "zod";

// Base Identifier Schema
export const uuidSchema = z.string().uuid("Invalid UUID identifier");

// 1. Orchestrator Agent
export const orchestratorTriggerSchema = z.enum([
  "onboarding",
  "create_content",
  "weekly_strategy",
  "custom_prompt",
]);

export const orchestratorInputSchema = z
  .object({
    workspaceId: uuidSchema,
    trigger: orchestratorTriggerSchema,
    parameters: z.record(z.unknown()).default({}),
  })
  .strict();

export const orchestratorStepPlanSchema = z
  .object({
    stepIndex: z.number().int().nonnegative(),
    agentName: z.string().min(1).max(60),
    requiresApproval: z.boolean().default(false),
    description: z.string().min(1).max(255),
  })
  .strict();

export const orchestratorOutputSchema = z
  .object({
    planId: z.string().min(1),
    workflowType: z.string().min(1),
    title: z.string().min(1).max(255),
    steps: z.array(orchestratorStepPlanSchema).min(1),
    estimatedCredits: z.number().int().nonnegative(),
  })
  .strict();

// 2. Researcher Agent
export const researcherInputSchema = z
  .object({
    niche: z.string().min(1).max(100),
    topicQuery: z.string().min(1).max(300),
    platforms: z
      .array(z.enum(["tiktok", "instagram", "youtube", "linkedin"]))
      .min(1),
    language: z.enum(["id", "en"]).default("id"),
  })
  .strict();

export const researcherCitationSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    excerpt: z.string().min(1),
  })
  .strict();

export const researcherOutputSchema = z
  .object({
    summary: z.string().min(1),
    trendingHooks: z.array(z.string().min(1)),
    audiencePainPoints: z.array(z.string().min(1)),
    contentOpportunities: z.array(
      z
        .object({
          topic: z.string().min(1),
          demandLevel: z.enum(["high", "medium"]),
          competitionLevel: z.enum(["low", "medium", "high"]),
        })
        .strict()
    ),
    verifiedCitations: z.array(researcherCitationSchema),
  })
  .strict();

// 3. Strategist Agent
export const strategistInputSchema = z
  .object({
    creatorDna: z
      .object({
        niche: z.string().min(1),
        tone: z.array(z.string()).min(1),
        archetype: z.string().min(1),
      })
      .strict(),
    researchReportId: uuidSchema.optional(),
    timeframeWeeks: z.number().int().min(1).max(12).default(4),
    weeklyCadence: z.number().int().min(1).max(14).default(3),
  })
  .strict();

export const strategistOutputSchema = z
  .object({
    strategyTitle: z.string().min(1),
    pillars: z.array(
      z
        .object({
          name: z.string().min(1),
          description: z.string().min(1),
          ratioPercentage: z.number().min(0).max(100),
          exampleTopics: z.array(z.string().min(1)),
        })
        .strict()
    ),
    weeklySchedule: z.array(
      z
        .object({
          dayOfWeek: z.number().int().min(1).max(7),
          recommendedPillar: z.string().min(1),
          format: z.string().min(1),
        })
        .strict()
    ),
  })
  .strict();

// 4. Idea Generator Agent
export const ideaGeneratorInputSchema = z
  .object({
    pillarName: z.string().min(1),
    count: z.number().int().min(1).max(10).default(3),
    platform: z.enum(["tiktok", "instagram", "youtube", "linkedin"]),
    creatorTone: z.array(z.string()).min(1),
  })
  .strict();

export const ideaGeneratorOutputSchema = z
  .object({
    ideas: z.array(
      z
        .object({
          title: z.string().min(1),
          hookAngle: z.enum([
            "curiosity",
            "contrarian",
            "tutorial",
            "case_study",
            "relatable",
          ]),
          hookPreview: z.string().min(1),
          targetEmotion: z.string().min(1),
          estimatedPotentialScore: z.number().min(0).max(100),
        })
        .strict()
    ),
  })
  .strict();

// 5. Scriptwriter Agent
export const scriptwriterInputSchema = z
  .object({
    ideaTitle: z.string().min(1),
    hookAngle: z.string().min(1),
    platform: z.enum(["tiktok", "instagram", "youtube"]),
    targetDurationSeconds: z.number().int().min(15).max(300).default(60),
    framework: z.enum(["AIDA", "PAS", "BAB", "Story"]).default("AIDA"),
    creatorPersona: z
      .object({
        tone: z.array(z.string()),
        language: z.enum(["id", "en"]).default("id"),
      })
      .strict(),
  })
  .strict();

export const scriptwriterOutputSchema = z
  .object({
    openingHook: z.string().min(1),
    bodyContent: z.string().min(1),
    closingCta: z.string().min(1),
    caption: z.string().min(1),
    hashtags: z.array(z.string().min(1)),
    estimatedDurationSeconds: z.number().int().min(1),
    wordCount: z.number().int().min(1),
  })
  .strict();

// 6. Storyboard Agent
export const storyboardAgentInputSchema = z
  .object({
    scriptId: uuidSchema.optional(),
    fullScriptText: z.string().min(1),
    aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  })
  .strict();

export const storyboardSceneSchema = z
  .object({
    sceneNumber: z.number().int().min(1),
    durationSeconds: z.number().min(1),
    spokenText: z.string().default(""),
    visualDescription: z.string().min(1),
    cameraAngle: z.enum([
      "close-up",
      "medium-shot",
      "wide-shot",
      "pov",
      "screen-record",
    ]),
    onScreenText: z.string().default(""),
    audioCue: z.string().default(""),
  })
  .strict();

export const storyboardAgentOutputSchema = z
  .object({
    scenes: z.array(storyboardSceneSchema).min(1),
  })
  .strict();

// 7. Designer Agent
export const designerAgentInputSchema = z
  .object({
    title: z.string().min(1),
    visualTheme: z.string().min(1),
    palette: z
      .object({
        primary: z.string().min(1),
        secondary: z.string().min(1),
      })
      .strict(),
    assetType: z.enum(["thumbnail", "carousel_slide", "story_cover"]),
  })
  .strict();

export const designerAgentOutputSchema = z
  .object({
    suggestedHeadline: z.string().min(1),
    imagePrompt: z.string().min(1),
    negativePrompt: z.string().min(1),
    layoutGuidelines: z.string().min(1),
    recommendedDimensions: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

// 8. Producer Agent
export const producerAgentInputSchema = z
  .object({
    storyboardId: uuidSchema.optional(),
    scenes: z.array(z.unknown()).optional(),
    voiceId: z.string().default("budi"),
    language: z.enum(["id", "en"]).default("id"),
    generateVideoPreviews: z.boolean().default(true),
  })
  .strict();

export const producerAgentOutputSchema = z
  .object({
    mediaJobId: z.string().min(1),
    dispatchedAssetTypes: z.array(z.string()),
    status: z.enum(["dispatched", "processing", "ready"]),
    summary: z.string().min(1),
  })
  .strict();

// 9. Analyst Agent
export const analystAgentInputSchema = z
  .object({
    contentItemId: z.string().min(1),
    metrics: z
      .object({
        views: z.number().int().nonnegative(),
        likes: z.number().int().nonnegative(),
        comments: z.number().int().nonnegative(),
        shares: z.number().int().nonnegative(),
        watchTimeSeconds: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const analystAgentOutputSchema = z
  .object({
    performanceGrade: z.enum(["A", "B", "C", "D"]),
    keyStrengths: z.array(z.string().min(1)),
    dropOffAnalysis: z.string().min(1),
    iterativeRecommendations: z.array(z.string().min(1)),
  })
  .strict();

// 10. Monetization Coach Agent
export const monetizationCoachInputSchema = z
  .object({
    workspaceId: uuidSchema,
    creatorMode: z.enum(["affiliate", "creator", "business", "personal_brand"]),
    currentFollowers: z.number().int().nonnegative(),
    avgViewsPerPost: z.number().int().nonnegative(),
  })
  .strict();

export const monetizationCoachOutputSchema = z
  .object({
    monetizationPotentialScore: z.number().min(0).max(100),
    recommendedAffiliateCategories: z.array(z.string().min(1)),
    digitalProductIdeas: z.array(
      z
        .object({
          title: z.string().min(1),
          format: z.enum(["ebook", "notion_template", "mini_course"]),
          targetPriceIdr: z.number().int().positive(),
        })
        .strict()
    ),
    estimatedSponsorshipRateIdr: z
      .object({
        min: z.number().int().nonnegative(),
        max: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

// Workflow Orchestrator API & Execution Schemas
export const startWorkflowRequestSchema = z
  .object({
    workspaceId: uuidSchema,
    userId: uuidSchema.optional(),
    workflowType: z.enum([
      "workflow_a_research_to_storyboard",
      "workflow_b_affiliate_pipeline",
      "workflow_c_analytics_optimization",
      "custom",
    ]),
    title: z.string().min(1).max(255),
    initialParameters: z.record(z.unknown()).default({}),
    autoApproveMilestones: z.boolean().default(false),
  })
  .strict();

export const workflowApprovalRequestSchema = z
  .object({
    runId: uuidSchema,
    stepIndex: z.number().int().nonnegative(),
  })
  .strict();

export const workflowScheduleCreateSchema = z
  .object({
    workspaceId: uuidSchema,
    userId: uuidSchema.optional(),
    workflowType: z.enum([
      "workflow_a_research_to_storyboard",
      "workflow_b_affiliate_pipeline",
      "workflow_c_analytics_optimization",
      "custom",
    ]),
    name: z.string().min(1).max(255),
    cronExpression: z.string().min(1).max(100),
    parameters: z.record(z.unknown()).default({}),
    maxAutonomousTurns: z.number().int().min(1).max(5).default(5),
  })
  .strict();

// TypeScript Type Exports
export type OrchestratorInput = z.infer<typeof orchestratorInputSchema>;
export type OrchestratorOutput = z.infer<typeof orchestratorOutputSchema>;
export type ResearcherInput = z.infer<typeof researcherInputSchema>;
export type ResearcherOutput = z.infer<typeof researcherOutputSchema>;
export type StrategistInput = z.infer<typeof strategistInputSchema>;
export type StrategistOutput = z.infer<typeof strategistOutputSchema>;
export type IdeaGeneratorInput = z.infer<typeof ideaGeneratorInputSchema>;
export type IdeaGeneratorOutput = z.infer<typeof ideaGeneratorOutputSchema>;
export type ScriptwriterInput = z.infer<typeof scriptwriterInputSchema>;
export type ScriptwriterOutput = z.infer<typeof scriptwriterOutputSchema>;
export type StoryboardAgentInput = z.infer<typeof storyboardAgentInputSchema>;
export type StoryboardAgentOutput = z.infer<typeof storyboardAgentOutputSchema>;
export type DesignerAgentInput = z.infer<typeof designerAgentInputSchema>;
export type DesignerAgentOutput = z.infer<typeof designerAgentOutputSchema>;
export type ProducerAgentInput = z.infer<typeof producerAgentInputSchema>;
export type ProducerAgentOutput = z.infer<typeof producerAgentOutputSchema>;
export type AnalystAgentInput = z.infer<typeof analystAgentInputSchema>;
export type AnalystAgentOutput = z.infer<typeof analystAgentOutputSchema>;
export type MonetizationCoachInput = z.infer<typeof monetizationCoachInputSchema>;
export type MonetizationCoachOutput = z.infer<typeof monetizationCoachOutputSchema>;
export type StartWorkflowRequest = z.infer<typeof startWorkflowRequestSchema>;
export type WorkflowApprovalRequest = z.infer<typeof workflowApprovalRequestSchema>;
export type WorkflowScheduleCreateRequest = z.infer<typeof workflowScheduleCreateSchema>;
