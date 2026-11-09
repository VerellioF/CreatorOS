import { describe, it, expect } from "vitest";
import {
  collectResearchEvidence,
  isSafePublicHttpUrl,
} from "@/lib/research/web-evidence-collector";
import {
  aiResearchSynthesisOutputSchema,
  competitorProfileInputSchema,
  researchSourceRecordSchema,
  traceableTrendClaimSchema,
} from "@/lib/validation/research-schemas";
import {
  aiContentPackageOutputSchema,
  aiContentStrategyOutputSchema,
  aiIdeaBatchOutputSchema,
  brandProfileInputSchema,
  contentPillarEditableSchema,
} from "@/lib/validation/strategy-and-content-schemas";
import {
  formatPlatformRulesPrompt,
  PLATFORM_RULES,
} from "@/lib/content/platform-rules";
import { AI_OPERATION_CREDIT_COSTS } from "@/lib/ai/token-budget";

describe("Phase 3 Unit Tests — Research Provenance, SSRF Protection, Strategy & Content Schemas", () => {
  it("blocks SSRF private/loopback/link-local hosts and non-HTTP schemes while allowing valid public URLs", () => {
    expect(isSafePublicHttpUrl("https://news.google.com/rss/search?q=umkm")).toBe(true);
    expect(isSafePublicHttpUrl("https://www.bps.go.id/id/publication")).toBe(true);

    expect(isSafePublicHttpUrl("http://localhost:3000/api/internal")).toBe(false);
    expect(isSafePublicHttpUrl("http://127.0.0.1:5432")).toBe(false);
    expect(isSafePublicHttpUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSafePublicHttpUrl("http://10.0.0.5/admin")).toBe(false);
    expect(isSafePublicHttpUrl("http://172.16.10.2/internal")).toBe(false);
    expect(isSafePublicHttpUrl("http://192.168.1.1/router")).toBe(false);
    expect(isSafePublicHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafePublicHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("enforces all 6 mandatory fields on recorded research sources", () => {
    const valid = researchSourceRecordSchema.safeParse({
      sourceUrl: "https://katadata.co.id/digital/berita-umkm",
      sourceTitle: "Laporan Digitalisasi UMKM Indonesia",
      retrievedAt: "2026-10-30T15:00:00.000Z",
      relevantExtract:
        "Adopsi video pendek oleh pelaku usaha kuliner meningkat untuk edukasi menu harian.",
      dataLimitations:
        "Ringkasan artikel berita publik; tidak mencakup data konversi internal merchant.",
      confidenceLevel: "high",
      confidenceRationale: "Sumber media ekonomi nasional dengan konteks relevan.",
      sourceOrigin: "rss_feed",
    });
    expect(valid.success).toBe(true);

    const missingTimestamp = researchSourceRecordSchema.safeParse({
      sourceUrl: "https://katadata.co.id/digital/berita-umkm",
      sourceTitle: "Laporan Digitalisasi UMKM Indonesia",
      retrievedAt: "bukan-tanggal",
      relevantExtract: "Kutipan relevan dari artikel berita.",
      dataLimitations: "Hanya data publik.",
      confidenceLevel: "medium",
      confidenceRationale: "Media publik.",
    });
    expect(missingTimestamp.success).toBe(false);
  });

  it("requires supportingSourceUrls when a trend claim is marked verified_by_sources", () => {
    const unverifiedClaimclaimingVerified = traceableTrendClaimSchema.safeParse({
      claim: "Format tutorial layar belah populer di kalangan kreator edukasi Excel.",
      directionOrPattern: "Meningkat pada konten berdurasi 35-50 detik.",
      evidenceStatus: "verified_by_sources",
      supportingSourceUrls: [],
      confidenceLevel: "medium",
      dataLimitation: "Pengamatan sampel publik terbatas.",
    });
    expect(unverifiedClaimclaimingVerified.success).toBe(false);

    const validTraceableClaim = traceableTrendClaimSchema.safeParse({
      claim: "Format tutorial layar belah populer di kalangan kreator edukasi Excel.",
      directionOrPattern: "Meningkat pada konten berdurasi 35-50 detik.",
      evidenceStatus: "verified_by_sources",
      supportingSourceUrls: ["https://blog.youtube/news-and-events/shorts-trends/"],
      confidenceLevel: "high",
      dataLimitation: "Berdasarkan rilis resmi blog platform publik.",
    });
    expect(validTraceableClaim.success).toBe(true);
  });

  it("explains transparently why real-time web data is unavailable when live news fetch is skipped or empty", async () => {
    const offlineEvidence = await collectResearchEvidence({
      query: "Konten produktivitas kerja remote",
      language: "id",
      skipLiveNewsFetch: true,
    });

    expect(offlineEvidence.realtimeDataAvailable).toBe(false);
    expect(offlineEvidence.realtimeUnavailableReason).toBeTruthy();
    expect((offlineEvidence.realtimeUnavailableReason ?? "").length).toBeGreaterThan(20);
  });

  it("validates editable content pillars, brand context, and blocks forbidden income/virality promises across Strategy, Ideas & Scripts", () => {
    const validBrand = brandProfileInputSchema.safeParse({
      brandName: "Kopi Jujur Studio",
      tagline: "Edukasi seduh kopi rumahan tanpa alat mahal",
      positioningStatement:
        "Membantu pekerja kantoran menyeduh kopi nikmat di rumah dalam 5 menit.",
      offerSummary: "Biji kopi sangrai segar dan panduan seduh praktis.",
      brandValues: ["Transparan", "Praktis", "Ramah Pemula"],
      voiceGuidelines: ["Hangat seperti teman kantor", "Hindari istilah barista rumit"],
    });
    expect(validBrand.success).toBe(true);

    const validEditablePillar = contentPillarEditableSchema.safeParse({
      strategyId: "550e8400-e29b-41d4-a716-446655440000",
      name: "Eksperimen Alat Seduh Hemat",
      description: "Uji coba alat seduh di bawah Rp150 ribu dengan takaran terukur.",
      objective: "educate",
      ratioPercentage: 40,
      exampleTopics: ["V60 plastik vs keramik", "Takaran kopi tanpa timbangan digital"],
      recommendedFormats: ["Reels 45 detik", "Carousel 5 slide"],
      colorCode: "#10B981",
      sortOrder: 0,
    });
    expect(validEditablePillar.success).toBe(true);

    const hypeIdeaBatch = aiIdeaBatchOutputSchema.safeParse({
      batchSummary: "Kumpulan ide konten mingguan.",
      ideas: [
        {
          title: "Konten ini dijamin viral dan pasti cuan ratusan juta besok!",
          hookConcept: "Tonton ini agar langsung kaya mendadak.",
          angleType: "curiosity",
          targetPlatform: "tiktok",
          opportunityScore: 95,
          opportunityRationale: "Pasti meledak di FYP.",
          researchTrace: "Berdasarkan tren.",
          suggestedPillarName: "Edukasi",
        },
      ],
    });
    expect(hypeIdeaBatch.success).toBe(false);

    const hypeScript = aiContentPackageOutputSchema.safeParse({
      title: "Cara Seduh V60",
      contentFormat: "Reels 9:16",
      framework: "PAS",
      openingHook: "Video ini dijamin fyp dan membuat Anda auto kaya dari kopi!",
      hookVariants: [
        { style: "Curiosity", hookText: "Satu kesalahan seduh V60", visualCue: "Close up" },
        { style: "Contrarian", hookText: "Jangan seduh dengan air mendidih", visualCue: "Termometer" },
        { style: "Story", hookText: "Dulu kopi saya selalu pahit", visualCue: "Cangkir" },
      ],
      bodyContent: "Langkah pertama bilas kertas filter terlebih dahulu sebelum menyeduh.",
      closingCta: "Simpan panduan ini untuk seduhan besok pagi.",
      ctaVariants: ["Bagikan ke teman ngopi", "Tulis alat seduh favoritmu"],
      visualAndAudioCues: [
        {
          beatLabel: "0-3s Hook",
          spokenSummary: "Kesalahan umum seduh V60",
          visualDirection: "Pour over close-up",
          onScreenTextOrAudio: "Teks: Jangan lakukan ini",
        },
        {
          beatLabel: "4-30s Solusi",
          spokenSummary: "Gunakan rasio 1 banding 15",
          visualDirection: "Timbangan kopi",
          onScreenTextOrAudio: "15g kopi : 225ml air",
        },
      ],
      estimatedDurationSeconds: 40,
      caption: "Panduan praktis menyeduh kopi V60 yang bersih dan seimbang.",
      hashtags: ["#kopirumahan", "#manualbrew", "#edukasikopi"],
      hashtagTiers: {
        broad: ["#kopi"],
        niche: ["#manualbrewindonesia"],
        specific: ["#resepseduhv60"],
      },
      platformAdaptationNotes: "Format vertikal dengan teks kontras tinggi.",
    });
    expect(hypeScript.success).toBe(false);

    expect(aiContentStrategyOutputSchema).toBeDefined();
    expect(aiResearchSynthesisOutputSchema).toBeDefined();
    expect(competitorProfileInputSchema).toBeDefined();
  });

  it("defines distinct platform rules and credit costs across all 6 target platforms and 7 Phase 3 AI operations", () => {
    const platforms = ["tiktok", "instagram", "youtube", "linkedin", "threads", "x"] as const;
    for (const p of platforms) {
      expect(PLATFORM_RULES[p].maxCaptionLength).toBeGreaterThan(200);
      const formatted = formatPlatformRulesPrompt(p);
      expect(formatted).toContain(PLATFORM_RULES[p].label.toUpperCase());
    }
    expect(PLATFORM_RULES.threads.maxCaptionLength).toBeLessThan(
      PLATFORM_RULES.linkedin.maxCaptionLength
    );

    expect(AI_OPERATION_CREDIT_COSTS.trend_research_generation).toBeGreaterThan(0);
    expect(AI_OPERATION_CREDIT_COSTS.competitor_research_generation).toBeGreaterThan(0);
    expect(AI_OPERATION_CREDIT_COSTS.audience_research_generation).toBeGreaterThan(0);
    expect(AI_OPERATION_CREDIT_COSTS.content_strategy_generation).toBeGreaterThan(0);
    expect(AI_OPERATION_CREDIT_COSTS.content_idea_generation).toBeGreaterThan(0);
    expect(AI_OPERATION_CREDIT_COSTS.content_package_generation).toBeGreaterThan(0);
    expect(AI_OPERATION_CREDIT_COSTS.platform_content_adaptation).toBeGreaterThan(0);
  });
});
