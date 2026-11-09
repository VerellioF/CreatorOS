import { describe, it, expect, vi } from "vitest";
import {
  OrchestratorAgent,
  ResearcherAgent,
  StrategistAgent,
  IdeaGeneratorAgent,
  ScriptwriterAgent,
  StoryboardAgent,
  DesignerAgent,
  ProducerAgent,
  AnalystAgent,
  MonetizationCoachAgent,
  BaseAgent,
} from "@/lib/ai/agents";
import { z } from "zod";

describe("Phase 5 BaseAgent Runner & Policy Enforcement", () => {
  it("enforces timeout when an agent execution exceeds configured timeoutMs", async () => {
    class SlowAgent extends BaseAgent<{ delay: number }, { done: boolean }> {
      constructor() {
        super({
          name: "slow_agent",
          description: "Simulates timeout",
          inputSchema: z.object({ delay: z.number() }),
          outputSchema: z.object({ done: z.boolean() }),
          maxRetries: 0,
          timeoutMs: 50,
        });
      }

      protected async runInternal(input: { delay: number }) {
        await new Promise((resolve) => setTimeout(resolve, input.delay));
        return { output: { done: true } };
      }
    }

    const agent = new SlowAgent();
    await expect(
      agent.execute(
        { delay: 200 },
        { workspaceId: "11111111-1111-4111-8111-111111111111" }
      )
    ).rejects.toThrow(/timed out/i);
  });

  it("retries failed executions up to maxRetries before throwing error", async () => {
    let attempts = 0;
    class FlakyAgent extends BaseAgent<{ shouldFail: boolean }, { attempts: number }> {
      constructor() {
        super({
          name: "flaky_agent",
          description: "Simulates transient failure",
          inputSchema: z.object({ shouldFail: z.boolean() }),
          outputSchema: z.object({ attempts: z.number() }),
          maxRetries: 2,
          timeoutMs: 1000,
        });
      }

      protected async runInternal() {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Transient failure attempt ${attempts}`);
        }
        return { output: { attempts } };
      }
    }

    const agent = new FlakyAgent();
    const result = await agent.execute(
      { shouldFail: true },
      { workspaceId: "11111111-1111-4111-8111-111111111111" }
    );

    expect(result.status).toBe("completed");
    expect(result.output.attempts).toBe(3);
    expect(result.logs.some((l) => l.level === "warn" && l.message.includes("retrying"))).toBe(true);
  });
});

describe("Phase 5 All 10 Specialized Agents", () => {
  const mockContext = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    creatorDna: {
      niche: "Tech & Software",
      tone: ["practical", "inspiring"],
      archetype: "The Builder",
    },
  };

  it("1. OrchestratorAgent generates a structured execution DAG for Workflow A", async () => {
    const orchestrator = new OrchestratorAgent();
    const result = await orchestrator.execute(
      {
        workspaceId: mockContext.workspaceId,
        trigger: "create_content",
        parameters: { topic: "Modern Coding Tools" },
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.steps.length).toBeGreaterThanOrEqual(4);
    expect(result.output.steps[0].agentName).toBe("researcher");
  });

  it("2. ResearcherAgent produces structured trends with citations", async () => {
    const researcher = new ResearcherAgent();
    const result = await researcher.execute(
      {
        niche: "Tech Education",
        topicQuery: "AI Developer Workflows",
        platforms: ["tiktok", "youtube"],
        language: "id",
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.trendingHooks.length).toBeGreaterThan(0);
    expect(result.output.verifiedCitations.length).toBeGreaterThan(0);
  });

  it("3. StrategistAgent produces content pillars and publishing cadence", async () => {
    const strategist = new StrategistAgent();
    const result = await strategist.execute(
      {
        creatorDna: mockContext.creatorDna,
        timeframeWeeks: 4,
        weeklyCadence: 3,
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.pillars.length).toBeGreaterThan(0);
    expect(result.output.weeklySchedule.length).toBe(3);
  });

  it("4. IdeaGeneratorAgent produces hook angles with psychological triggers", async () => {
    const ideaGen = new IdeaGeneratorAgent();
    const result = await ideaGen.execute(
      {
        pillarName: "Tutorials",
        count: 2,
        platform: "tiktok",
        creatorTone: ["direct", "sharp"],
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.ideas).toHaveLength(2);
    expect(result.output.ideas[0].hookAngle).toBeDefined();
  });

  it("5. ScriptwriterAgent produces retention-optimized script with cues", async () => {
    const scriptwriter = new ScriptwriterAgent();
    const result = await scriptwriter.execute(
      {
        ideaTitle: "How to Build Agents",
        hookAngle: "contrarian",
        platform: "tiktok",
        targetDurationSeconds: 45,
        framework: "PAS",
        creatorPersona: { tone: ["educational"], language: "id" },
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.openingHook).toBeDefined();
    expect(result.output.closingCta).toBeDefined();
    expect(result.output.hashtags.length).toBeGreaterThan(0);
  });

  it("6. StoryboardAgent produces scene-by-scene visual direction", async () => {
    const storyboard = new StoryboardAgent();
    const result = await storyboard.execute(
      {
        fullScriptText: "Opening Hook... Body content... Closing CTA...",
        aspectRatio: "9:16",
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.scenes.length).toBeGreaterThan(0);
    expect(result.output.scenes[0].cameraAngle).toBeDefined();
  });

  it("7. DesignerAgent produces thumbnail and graphic prompts", async () => {
    const designer = new DesignerAgent();
    const result = await designer.execute(
      {
        title: "Agent Workflows Explained",
        visualTheme: "Dark Tech",
        palette: { primary: "#00FFCC", secondary: "#111122" },
        assetType: "thumbnail",
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.suggestedHeadline).toBeDefined();
    expect(result.output.imagePrompt).toBeDefined();
  });

  it("8. ProducerAgent coordinates media generation dispatch", async () => {
    const producer = new ProducerAgent();
    const result = await producer.execute(
      {
        voiceId: "budi",
        language: "id",
        generateVideoPreviews: true,
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.mediaJobId).toBeDefined();
    expect(result.output.dispatchedAssetTypes).toContain("voiceover");
  });

  it("9. AnalystAgent evaluates performance metrics and retention", async () => {
    const analyst = new AnalystAgent();
    const result = await analyst.execute(
      {
        contentItemId: "item_999",
        metrics: { views: 12000, likes: 1100, comments: 90, shares: 250, watchTimeSeconds: 42 },
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(["A", "B", "C", "D"]).toContain(result.output.performanceGrade);
    expect(result.output.iterativeRecommendations.length).toBeGreaterThan(0);
  });

  it("10. MonetizationCoachAgent calculates sponsorship rates and digital product ideas", async () => {
    const coach = new MonetizationCoachAgent();
    const result = await coach.execute(
      {
        workspaceId: mockContext.workspaceId,
        creatorMode: "creator",
        currentFollowers: 25000,
        avgViewsPerPost: 15000,
      },
      mockContext
    );

    expect(result.status).toBe("completed");
    expect(result.output.monetizationPotentialScore).toBeGreaterThan(0);
    expect(result.output.estimatedSponsorshipRateIdr.min).toBeGreaterThan(0);
  });
});
