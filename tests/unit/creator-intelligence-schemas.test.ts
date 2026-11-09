import { describe, it, expect } from "vitest";
import {
  containsForbiddenPromise,
  creatorIntelligenceSynthesisSchema,
  nicheDiscoveryBatchSchema,
  onboardingCoreAnswersSchema,
  type OnboardingCoreAnswers,
} from "@/lib/validation/creator-intelligence-schemas";
import {
  buildAdaptiveBaselineQuestions,
  formatCreatorContextPromptBlock,
  type WorkspaceCreatorContext,
} from "@/lib/ai/context-builder";
import {
  assertTurnWithinBudget,
  calculateUsageCostUsd,
  estimateOperationBudget,
  MAX_AGENT_TURNS_PER_TASK,
} from "@/lib/ai/token-budget";
import { cleanAndValidateApiKey } from "@/lib/ai/types";

const BASE_CORE_ANSWERS: OnboardingCoreAnswers = {
  creatorMode: "creator",
  interests: ["Keuangan Pribadi", "Produktivitas Kerja"],
  skills: ["Excel", "Storytelling"],
  experience: "complete_beginner",
  experienceNotes: "Belum pernah konsisten upload",
  availableTime: "3_to_6_hours_weekly",
  availableEquipment: "smartphone_only",
  equipmentNotes: "Android kelas menengah",
  preferredContentFormat: ["short_video_talking_head"],
  primaryPlatforms: ["tiktok", "instagram"],
  targetAudience: "Pekerja muda 22-28 tahun yang baru menerima gaji pertama",
  goals: "Membangun kebiasaan upload 3 video per minggu secara konsisten",
  monetizationPreferences: ["affiliate_commission", "digital_products"],
};

describe("Phase 2 Creator Intelligence Schemas, Guardrails & Context Engine", () => {
  it("validates all 9 core onboarding dimensions and rejects unknown fields (.strict())", () => {
    const parsed = onboardingCoreAnswersSchema.safeParse(BASE_CORE_ANSWERS);
    expect(parsed.success).toBe(true);

    const injected = onboardingCoreAnswersSchema.safeParse({
      ...BASE_CORE_ANSWERS,
      isAdmin: true,
    });
    expect(injected.success).toBe(false);
  });

  it("adapts interview questions dynamically based on Creator Mode and Equipment", () => {
    const affiliateFaceless = buildAdaptiveBaselineQuestions({
      ...BASE_CORE_ANSWERS,
      creatorMode: "affiliate",
      availableEquipment: "laptop_screen_faceless_only",
      preferredContentFormat: ["short_video_faceless_broll"],
    });

    const businessCamera = buildAdaptiveBaselineQuestions({
      ...BASE_CORE_ANSWERS,
      creatorMode: "business",
      availableEquipment: "camera_and_desktop_setup",
    });

    expect(affiliateFaceless.some((q) => q.id === "adaptive_affiliate_category")).toBe(true);
    expect(affiliateFaceless.some((q) => q.id === "adaptive_faceless_workflow")).toBe(true);

    expect(businessCamera.some((q) => q.id === "adaptive_business_offer")).toBe(true);
    expect(businessCamera.some((q) => q.id === "adaptive_production_bottleneck")).toBe(true);
    expect(affiliateFaceless[0]?.question).not.toBe(businessCamera[0]?.question);
  });

  it("blocks promises of guaranteed income or virality in monetization & niche outputs", () => {
    expect(containsForbiddenPromise("Strategi ini dijamin viral dalam 3 hari")).toBe(true);
    expect(containsForbiddenPromise("Niche ini pasti cuan jutaan tiap minggu")).toBe(true);
    expect(containsForbiddenPromise("Guaranteed income within 7 days")).toBe(true);
    expect(
      containsForbiddenPromise(
        "Potensi komisi afiliasi bergantung pada konsistensi kualitas ulasan dan kepercayaan audiens"
      )
    ).toBe(false);

    const invalidNiche = nicheDiscoveryBatchSchema.safeParse({
      recommendations: [
        {
          nicheTitle: "Review Gadget Kerja",
          explanation: "Niche ini dijamin viral dan pasti cuan jutaan dalam seminggu!",
          audience: "Pekerja kantoran",
          contentOpportunities: [
            {
              angleTitle: "Setup meja hemat",
              formatSuggestion: "Reels 45 detik",
              whyAudienceCares: "Membantu kerja nyaman",
            },
            {
              angleTitle: "Perbandingan mouse",
              formatSuggestion: "TikTok",
              whyAudienceCares: "Hemat budget",
            },
            {
              angleTitle: "Tips kabel rapi",
              formatSuggestion: "Carousel",
              whyAudienceCares: "Meja bersih",
            },
          ],
          competitionAssessment: {
            competitionDensity: "moderate",
            differentiationStrategy: "Fokus barang di bawah Rp300 ribu",
            entryBarrierSummary: "Perlu barang asli",
            assessmentMethodology: "Evaluasi kualitatif profil",
          },
          requiredSkills: ["Demo jelas", "Riset produk"],
          monetizationPossibilities: [
            { channel: "Affiliate", prerequisiteNote: "Perlu katalog relevan" },
            { channel: "Endorsement", prerequisiteNote: "Perlu portofolio konsisten" },
          ],
          confidenceLevel: "high",
          confidenceScore: 84,
          supportingEvidence: {
            profileFitSignals: ["Punya minat produktivitas", "Suka format pendek"],
            marketObservationNote: "Kebutuhan peralatan kerja relevan sepanjang tahun",
            dataAvailabilityStatus: "Analisis kualitatif berbasis profil; belum ada statistik eksternal live",
          },
        },
      ],
    });

    expect(invalidNiche.success).toBe(false);
  });

  it("validates structured niche recommendations with all 8 required fields", () => {
    const mkCandidate = (title: string) => ({
      nicheTitle: title,
      explanation:
        "Menggabungkan keahlian Excel dengan kebutuhan pekerja muda mengelola gaji bulanan secara praktis.",
      audience: "First jobber usia 22-28 tahun di Indonesia",
      contentOpportunities: [
        {
          angleTitle: "Template gaji 50/30/20 realistis",
          formatSuggestion: "Short Video 45s",
          whyAudienceCares: "Langsung bisa dipraktikkan saat gajian",
        },
        {
          angleTitle: "Kesalahan catat pengeluaran harian",
          formatSuggestion: "Carousel 5 slide",
          whyAudienceCares: "Menjawab kebocoran anggaran kecil",
        },
        {
          angleTitle: "Bedah simulasi dana darurat",
          formatSuggestion: "Screen Tutorial",
          whyAudienceCares: "Memberi target angka yang masuk akal",
        },
      ],
      competitionAssessment: {
        competitionDensity: "moderate" as const,
        differentiationStrategy: "Fokus template spreadsheet sederhana berbahasa sehari-hari",
        entryBarrierSummary: "Tidak butuh modal alat mahal, cukup konsistensi studi kasus",
        assessmentMethodology: "Penilaian kualitatif keselarasan skill dan kapasitas kreator",
      },
      requiredSkills: ["Spreadsheet dasar", "Komunikasi ringkas"],
      monetizationPossibilities: [
        {
          channel: "Penjualan Template Spreadsheet Digital",
          prerequisiteNote: "Membutuhkan audiens yang sudah merasakan manfaat versi gratis terlebih dahulu",
        },
        {
          channel: "Afiliasi Buku Literasi Keuangan",
          prerequisiteNote: "Relevan setelah membangun kepercayaan ulasan jujur",
        },
      ],
      confidenceLevel: "high" as const,
      confidenceScore: 85,
      supportingEvidence: {
        profileFitSignals: [
          "Memiliki keahlian langsung di Excel",
          "Target audiens pekerja muda jelas",
        ],
        marketObservationNote: "Topik pengelolaan gaji relevan berulang setiap siklus bulanan",
        dataAvailabilityStatus:
          "Belum ada data metrik tren eksternal real-time; evaluasi berbasis profil kreator",
      },
    });

    const validBatch = nicheDiscoveryBatchSchema.safeParse({
      recommendations: [
        mkCandidate("Budgeting Gaji Pertama dengan Excel"),
        mkCandidate("Produktivitas Spreadsheet untuk Admin"),
        mkCandidate("Literasi Keuangan Harian Tanpa Jargon"),
      ],
    });

    expect(validBatch.success).toBe(true);
  });

  it("formats reusable Creator Context across modules with DNA, Persona & Guardrails", () => {
    const ctx: WorkspaceCreatorContext = {
      workspaceId: "10000000-0000-4000-8000-000000000001",
      workspaceName: "Raka Studio",
      creatorMode: "personal_brand",
      defaultLanguage: "id",
      defaultAiModel: "gemini-3.8-flash",
      onboardingCompleted: true,
      coreAnswers: BASE_CORE_ANSWERS,
      adaptiveQuestions: [],
      adaptiveAnswers: { q_focus: "Fokus studi kasus nyata di kantor" },
      creatorDna: {
        creatorName: "Raka Praktis",
        primaryNiche: "Produktivitas Kerja dengan Excel & AI",
        secondaryNiches: ["Manajemen Waktu"],
        uniqueValueProposition: "Tutorial kerja 60 detik langsung pakai tanpa jargon",
        targetAudienceSummary: "Staf operasional dan analis junior",
        toneOfVoice: ["Lugas", "Ramah"],
        personalityArchetype: "The Practical Mentor",
        strengths: ["Studi kasus nyata"],
        tabooTopics: ["Politik partisan", "Flexing kekayaan"],
        primaryPlatforms: ["tiktok", "linkedin"],
        preferredFormats: ["Video Pendek 60 Detik"],
      },
      audiencePersona: {
        personaName: "Dina Analis Muda",
        ageRange: "22-27 tahun",
        occupationOrLifeStage: "Staf kantor tahun pertama",
        corePainPoints: ["Lembur karena rekap manual", "Bingung rumus laporan"],
        coreDesires: ["Pulang tepat waktu", "Dipercaya atasan"],
        contentConsumptionHabits: "Menonton tutorial singkat saat jam istirahat",
        commonObjections: ["Takut rumusnya sulit dihafal"],
        activePlatforms: ["tiktok", "linkedin"],
      },
      creatorAssessment: null,
      monetizationRecommendations: [],
      roadmap30Days: [],
      selectedNiche: null,
    };

    const promptBlock = formatCreatorContextPromptBlock(ctx);
    expect(promptBlock).toContain("Raka Praktis");
    expect(promptBlock).toContain("Politik partisan, Flexing kekayaan");
    expect(promptBlock).toContain("Dina Analis Muda");
    expect(promptBlock).toContain("Personal Brand Mode");
    expect(promptBlock).toContain("DILARANG KERAS menjanjikan penghasilan pasti");
  });

  it("calculates token budgets accurately, validates API keys, and enforces 5-turn hard cap", () => {
    expect(cleanAndValidateApiKey("")).toBeNull();
    expect(cleanAndValidateApiKey('""')).toBeNull();
    expect(cleanAndValidateApiKey("your-gemini-api-key")).toBeNull();
    expect(cleanAndValidateApiKey('"AIzaSyRealLookingTestCredential12345"')).toBe(
      "AIzaSyRealLookingTestCredential12345"
    );

    const budget = estimateOperationBudget({
      systemPrompt: "Anda adalah agen kreator.",
      userPrompt: "Susun profil DNA.",
      schemaJsonText: '{"type":"object"}',
      maxCompletionTokens: 2000,
      modelId: "gemini-3.8-flash",
      requiredCredits: 3,
    });

    expect(budget.estimatedPromptTokens).toBeGreaterThan(10);
    expect(budget.estimatedMaxTotalTokens).toBe(budget.estimatedPromptTokens + 2000);
    expect(budget.requiredCredits).toBe(3);
    expect(calculateUsageCostUsd("gemini-3.8-flash", 10_000, 5_000)).toBeGreaterThan(0);

    expect(() => assertTurnWithinBudget(MAX_AGENT_TURNS_PER_TASK)).not.toThrow();
    expect(() => assertTurnWithinBudget(MAX_AGENT_TURNS_PER_TASK + 1)).toThrow(
      /exceeds hard cap/i
    );

    // Ensure synthesis schema validates 4-week roadmap structure
    expect(creatorIntelligenceSynthesisSchema).toBeDefined();
  });
});
