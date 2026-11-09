import { describe, it, expect } from "vitest";
import {
  orchestratorInputSchema,
  orchestratorOutputSchema,
  researcherInputSchema,
  researcherOutputSchema,
  strategistInputSchema,
  strategistOutputSchema,
  ideaGeneratorInputSchema,
  ideaGeneratorOutputSchema,
  scriptwriterInputSchema,
  scriptwriterOutputSchema,
  storyboardAgentInputSchema,
  storyboardAgentOutputSchema,
  designerAgentInputSchema,
  designerAgentOutputSchema,
  producerAgentInputSchema,
  producerAgentOutputSchema,
  analystAgentInputSchema,
  analystAgentOutputSchema,
  monetizationCoachInputSchema,
  monetizationCoachOutputSchema,
  startWorkflowRequestSchema,
  workflowScheduleCreateSchema,
} from "@/lib/validation/agent-schemas";

describe("Phase 5 Agent Zod Schemas — All 10 Specialized Agents", () => {
  it("validates Orchestrator Agent input and output", () => {
    const validIn = orchestratorInputSchema.parse({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      trigger: "create_content",
      parameters: { topic: "AI Productivity Tools", platform: "tiktok" },
    });
    expect(validIn.trigger).toBe("create_content");

    const validOut = orchestratorOutputSchema.parse({
      planId: "plan_123",
      workflowType: "workflow_a_research_to_storyboard",
      title: "Content Creation: AI Productivity Tools",
      steps: [
        { stepIndex: 0, agentName: "researcher", requiresApproval: false, description: "Market research" },
        { stepIndex: 1, agentName: "strategist", requiresApproval: false, description: "Strategic angle" },
        { stepIndex: 2, agentName: "idea_generator", requiresApproval: false, description: "Ideation" },
        { stepIndex: 3, agentName: "scriptwriter", requiresApproval: true, description: "Scripting (requires review)" },
        { stepIndex: 4, agentName: "storyboard", requiresApproval: false, description: "Storyboard production" },
      ],
      estimatedCredits: 5,
    });
    expect(validOut.steps).toHaveLength(5);
  });

  it("validates Researcher Agent input and output", () => {
    const validIn = researcherInputSchema.parse({
      niche: "Tech Education",
      topicQuery: "Best AI agents for video creators in 2026",
      platforms: ["tiktok", "instagram"],
      language: "id",
    });
    expect(validIn.language).toBe("id");

    const validOut = researcherOutputSchema.parse({
      summary: "High audience interest in automated video scripting and storyboarding.",
      trendingHooks: ["Ini cara gue bikin 10 video dalam 1 jam pake AI", "Stop edit manual!"],
      audiencePainPoints: ["Kehabisan ide konten", "Proses editing terlalu lambat"],
      contentOpportunities: [
        { topic: "AI Video Automation", demandLevel: "high", competitionLevel: "medium" },
      ],
      verifiedCitations: [
        { title: "AI Creator Survey 2026", url: "https://example.com/survey", excerpt: "80% creators adopted AI tools." },
      ],
    });
    expect(validOut.verifiedCitations[0].url).toContain("https://");
  });

  it("validates Strategist Agent input and output", () => {
    const validIn = strategistInputSchema.parse({
      creatorDna: { niche: "Tech & Coding", tone: ["educational", "approachable"], archetype: "The Mentor" },
      timeframeWeeks: 4,
      weeklyCadence: 3,
    });
    expect(validIn.timeframeWeeks).toBe(4);

    const validOut = strategistOutputSchema.parse({
      strategyTitle: "Tech Mastery 4-Week Blueprint",
      pillars: [
        { name: "Tutorial & Tips", description: "Step-by-step guides", ratioPercentage: 50, exampleTopics: ["How to use Next.js"] },
        { name: "Industry Insights", description: "Trends and analysis", ratioPercentage: 50, exampleTopics: ["AI landscape"] },
      ],
      weeklySchedule: [
        { dayOfWeek: 1, recommendedPillar: "Tutorial & Tips", format: "short-form" },
        { dayOfWeek: 3, recommendedPillar: "Industry Insights", format: "carousel" },
        { dayOfWeek: 5, recommendedPillar: "Tutorial & Tips", format: "short-form" },
      ],
    });
    expect(validOut.pillars).toHaveLength(2);
  });

  it("validates Idea Generator Agent input and output", () => {
    const validIn = ideaGeneratorInputSchema.parse({
      pillarName: "Tutorial & Tips",
      count: 3,
      platform: "tiktok",
      creatorTone: ["sharp", "entertaining"],
    });
    expect(validIn.count).toBe(3);

    const validOut = ideaGeneratorOutputSchema.parse({
      ideas: [
        {
          title: "3 Website Rahasia untuk Creator Pemula",
          hookAngle: "curiosity",
          hookPreview: "Jangan tonton video ini kalau gamau viewersmu naik!",
          targetEmotion: "curiosity",
          estimatedPotentialScore: 92,
        },
      ],
    });
    expect(validOut.ideas[0].hookAngle).toBe("curiosity");
  });

  it("validates Scriptwriter Agent input and output", () => {
    const validIn = scriptwriterInputSchema.parse({
      ideaTitle: "3 Website Rahasia untuk Creator",
      hookAngle: "curiosity",
      platform: "tiktok",
      targetDurationSeconds: 45,
      framework: "PAS",
      creatorPersona: { tone: ["casual", "direct"], language: "id" },
    });
    expect(validIn.framework).toBe("PAS");

    const validOut = scriptwriterOutputSchema.parse({
      openingHook: "Kalian masih mikir bikin konten itu susah?",
      bodyContent: "Sebenarnya kuncinya ada di 3 website ini...",
      closingCta: "Save video ini dan share ke temen creator kamu!",
      caption: "3 website rahasia wajib coba buat naikin produktivitas konten kamu #CreatorTools",
      hashtags: ["#creatortools", "#tipscontent", "#productivity"],
      estimatedDurationSeconds: 45,
      wordCount: 110,
    });
    expect(validOut.hashtags).toHaveLength(3);
  });

  it("validates Storyboard Agent input and output", () => {
    const validIn = storyboardAgentInputSchema.parse({
      fullScriptText: "Opening Hook... Body content... Closing CTA...",
      aspectRatio: "9:16",
    });
    expect(validIn.aspectRatio).toBe("9:16");

    const validOut = storyboardAgentOutputSchema.parse({
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 5,
          spokenText: "Kalian masih mikir bikin konten itu susah?",
          visualDescription: "Creator looking directly into camera with confused face",
          cameraAngle: "close-up",
          onScreenText: "Bikin konten susah?",
          audioCue: "Curious chime sound effect",
        },
      ],
    });
    expect(validOut.scenes[0].cameraAngle).toBe("close-up");
  });

  it("validates Designer Agent input and output", () => {
    const validIn = designerAgentInputSchema.parse({
      title: "Mastering Next.js 15",
      visualTheme: "Cyber Minimalist",
      palette: { primary: "#00E5FF", secondary: "#1A1A2E" },
      assetType: "thumbnail",
    });
    expect(validIn.assetType).toBe("thumbnail");

    const validOut = designerAgentOutputSchema.parse({
      suggestedHeadline: "NEXT.JS 15 SECRETS",
      imagePrompt: "A sleek, glowing futuristic laptop on a dark acrylic desk with neon cyan accents",
      negativePrompt: "blurry, low resolution, messy text",
      layoutGuidelines: "Rule of thirds, title on top-left, hero element centered",
      recommendedDimensions: { width: 1280, height: 720 },
    });
    expect(validOut.recommendedDimensions.width).toBe(1280);
  });

  it("validates Producer Agent input and output", () => {
    const validIn = producerAgentInputSchema.parse({
      voiceId: "budi_tech",
      language: "id",
      generateVideoPreviews: true,
    });
    expect(validIn.language).toBe("id");

    const validOut = producerAgentOutputSchema.parse({
      mediaJobId: "job_xyz789",
      dispatchedAssetTypes: ["voiceover", "thumbnail", "video_clip"],
      status: "dispatched",
      summary: "Dispatched audio synthesis and visual assets to media worker queue",
    });
    expect(validOut.status).toBe("dispatched");
  });

  it("validates Analyst Agent input and output", () => {
    const validIn = analystAgentInputSchema.parse({
      contentItemId: "item_123",
      metrics: { views: 50000, likes: 4500, comments: 320, shares: 850, watchTimeSeconds: 38 },
    });
    expect(validIn.metrics.views).toBe(50000);

    const validOut = analystAgentOutputSchema.parse({
      performanceGrade: "A",
      keyStrengths: ["High share ratio (1.7%)", "Strong hook retention in first 3 seconds"],
      dropOffAnalysis: "Slight dip at second 25 during technical explanation; keep definitions under 5 seconds.",
      iterativeRecommendations: ["Reuse the contrast hook formula", "Add visual motion during data explanations"],
    });
    expect(validOut.performanceGrade).toBe("A");
  });

  it("validates Monetization Coach Agent input and output", () => {
    const validIn = monetizationCoachInputSchema.parse({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      creatorMode: "affiliate",
      currentFollowers: 15000,
      avgViewsPerPost: 8000,
    });
    expect(validIn.creatorMode).toBe("affiliate");

    const validOut = monetizationCoachOutputSchema.parse({
      monetizationPotentialScore: 84,
      recommendedAffiliateCategories: ["Productivity Software", "Microphones & Creator Gear"],
      digitalProductIdeas: [
        { title: "Notion Creator OS Template", format: "notion_template", targetPriceIdr: 99000 },
      ],
      estimatedSponsorshipRateIdr: { min: 1500000, max: 3500000 },
    });
    expect(validOut.estimatedSponsorshipRateIdr.min).toBe(1500000);
  });

  it("validates Workflow orchestration and schedule schemas", () => {
    const startReq = startWorkflowRequestSchema.parse({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      workflowType: "workflow_a_research_to_storyboard",
      title: "Automated Campaign: AI Productivity",
      initialParameters: { niche: "Tech", topic: "Productivity Apps" },
      autoApproveMilestones: false,
    });
    expect(startReq.workflowType).toBe("workflow_a_research_to_storyboard");

    const schedReq = workflowScheduleCreateSchema.parse({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      workflowType: "workflow_a_research_to_storyboard",
      name: "Weekly Monday Research & Planning",
      cronExpression: "0 9 * * 1",
      parameters: { niche: "Tech" },
      maxAutonomousTurns: 5,
    });
    expect(schedReq.maxAutonomousTurns).toBe(5);

    // Guardrail: max autonomous turns > 5 rejected
    expect(() =>
      workflowScheduleCreateSchema.parse({
        workspaceId: "11111111-1111-4111-8111-111111111111",
        workflowType: "workflow_a_research_to_storyboard",
        name: "Runaway test",
        cronExpression: "0 9 * * 1",
        maxAutonomousTurns: 10,
      })
    ).toThrow();
  });
});
