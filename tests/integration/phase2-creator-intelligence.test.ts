import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  StructuredTextRequest,
  StructuredTextResponse,
  TextGenerationProvider,
} from "@/lib/ai/types";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const WS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface InMemoryDb {
  activeUserId: string;
  profiles: Map<string, Record<string, unknown>>;
  workspaces: Map<string, Record<string, unknown>>;
  members: Array<{ workspace_id: string; user_id: string; role: string }>;
  settings: Map<string, Record<string, unknown>>;
  onboarding: Map<string, Record<string, unknown>>;
  creatorProfiles: Map<string, Record<string, unknown>>;
  niches: Array<Record<string, unknown>>;
  wallets: Map<string, { id: string; workspace_id: string; balance: number; monthly_allowance: number }>;
  usageLogs: Array<Record<string, unknown>>;
  creditTx: Array<Record<string, unknown>>;
}

let db: InMemoryDb;

function resetDb() {
  db = {
    activeUserId: USER_A,
    profiles: new Map([
      [USER_A, { id: USER_A, full_name: "Alya Kreator", onboarding_completed: false }],
      [USER_B, { id: USER_B, full_name: "Bima Bisnis", onboarding_completed: false }],
    ]),
    workspaces: new Map([
      [
        WS_A,
        {
          id: WS_A,
          name: "Alya Studio",
          slug: "alya-studio",
          creator_mode: "creator",
          deleted_at: null,
        },
      ],
      [
        WS_B,
        {
          id: WS_B,
          name: "Bima Corp",
          slug: "bima-corp",
          creator_mode: "business",
          deleted_at: null,
        },
      ],
    ]),
    members: [
      { workspace_id: WS_A, user_id: USER_A, role: "owner" },
      { workspace_id: WS_B, user_id: USER_B, role: "owner" },
    ],
    settings: new Map([
      [
        WS_A,
        {
          workspace_id: WS_A,
          default_language: "id",
          default_ai_model: "gemini-3.8-flash",
        },
      ],
    ]),
    onboarding: new Map(),
    creatorProfiles: new Map(),
    niches: [],
    wallets: new Map([
      [WS_A, { id: "wal-a", workspace_id: WS_A, balance: 50, monthly_allowance: 50 }],
      [WS_B, { id: "wal-b", workspace_id: WS_B, balance: 50, monthly_allowance: 50 }],
    ]),
    usageLogs: [],
    creditTx: [],
  };
}

function hasMemberRole(wsId: string, uid: string, minRole = "viewer"): boolean {
  const m = db.members.find((x) => x.workspace_id === wsId && x.user_id === uid);
  if (!m) return false;
  if (minRole === "viewer" || minRole === "member") return true;
  if (minRole === "editor") return ["owner", "admin", "editor"].includes(m.role);
  if (minRole === "admin") return ["owner", "admin"].includes(m.role);
  if (minRole === "owner") return m.role === "owner";
  return false;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: vi.fn(async (fnName: string, args: Record<string, unknown>) => {
      if (fnName === "has_workspace_access") {
        const ok = hasMemberRole(
          String(args.ws_id),
          db.activeUserId,
          String(args.minimum_role || "viewer")
        );
        return { data: ok, error: null };
      }

      if (fnName === "record_ai_usage_and_deduct_credits") {
        const wsId = String(args.target_workspace_id);
        if (!hasMemberRole(wsId, db.activeUserId, "editor")) {
          return { data: null, error: { message: "Unauthorized" } };
        }
        const wallet = db.wallets.get(wsId)!;
        const status = String(args.p_status || "success");
        const charge =
          status === "success" || status === "fallback_success"
            ? Number(args.p_credits_to_deduct)
            : 0;
        if (charge > 0 && wallet.balance < charge) {
          return { data: null, error: { message: "Insufficient workspace credits" } };
        }
        wallet.balance -= charge;
        const usageId = `usage-${db.usageLogs.length + 1}`;
        db.usageLogs.push({
          id: usageId,
          workspace_id: wsId,
          provider: args.p_provider,
          model_id: args.p_model_id,
          operation_type: args.p_operation_type,
          prompt_tokens: args.p_prompt_tokens,
          completion_tokens: args.p_completion_tokens,
          total_tokens: args.p_total_tokens,
          cost_usd: args.p_cost_usd,
          credits_charged: charge,
          duration_ms: args.p_duration_ms,
          status,
          created_at: new Date().toISOString(),
        });
        if (charge > 0) {
          db.creditTx.push({
            id: `tx-${db.creditTx.length + 1}`,
            wallet_id: wallet.id,
            amount: -charge,
            balance_after: wallet.balance,
            transaction_type: "ai_generation",
            reference_id: null,
            description: String(args.p_operation_type),
            created_at: new Date().toISOString(),
          });
        }
        return {
          data: {
            agent_run_id: `run-${db.usageLogs.length}`,
            usage_id: usageId,
            credits_deducted: charge,
            remaining_balance: wallet.balance,
          },
          error: null,
        };
      }

      if (fnName === "select_preferred_niche") {
        const wsId = String(args.target_workspace_id);
        const nicheId = String(args.target_niche_id);
        if (!hasMemberRole(wsId, db.activeUserId, "editor")) {
          return { data: null, error: { message: "Unauthorized" } };
        }
        const target = db.niches.find(
          (n) => n.id === nicheId && n.workspace_id === wsId
        );
        if (!target) {
          return { data: null, error: { message: "Not found" } };
        }
        for (const n of db.niches) {
          if (n.workspace_id === wsId) {
            n.is_selected = n.id === nicheId;
          }
        }
        const cp = db.creatorProfiles.get(wsId);
        if (cp) {
          cp.primary_niche = target.niche_title;
        }
        return { data: target.niche_title, error: null };
      }

      return { data: null, error: { message: `Unhandled RPC ${fnName}` } };
    }),

    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};

      const queryBuilder = {
        select: () => queryBuilder,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return queryBuilder;
        },
        is: (col: string, val: unknown) => {
          filters[col] = val;
          return queryBuilder;
        },
        order: () => queryBuilder,
        limit: () => queryBuilder,
        single: async () => {
          if (table === "workspace_members") {
            const wsId = String(filters.workspace_id);
            const uid = String(filters.user_id);
            const m = db.members.find(
              (x) => x.workspace_id === wsId && x.user_id === uid
            );
            const ws = db.workspaces.get(wsId);
            if (!m || !ws) {
              return { data: null, error: { message: "Not found" } };
            }
            return {
              data: { role: m.role, workspace: ws },
              error: null,
            };
          }
          return queryBuilder.maybeSingle();
        },
        maybeSingle: async () => {
          if (table === "workspaces") {
            const ws = db.workspaces.get(String(filters.id));
            if (!ws || !hasMemberRole(String(ws.id), db.activeUserId)) {
              return { data: null, error: null };
            }
            return { data: ws, error: null };
          }
          if (table === "workspace_settings") {
            return {
              data: db.settings.get(String(filters.workspace_id)) ?? null,
              error: null,
            };
          }
          if (table === "profiles") {
            return { data: db.profiles.get(String(filters.id)) ?? null, error: null };
          }
          if (table === "onboarding_sessions") {
            const wsId = String(filters.workspace_id);
            if (!hasMemberRole(wsId, db.activeUserId)) {
              return { data: null, error: null };
            }
            return { data: db.onboarding.get(wsId) ?? null, error: null };
          }
          if (table === "creator_profiles") {
            const wsId = String(filters.workspace_id);
            if (!hasMemberRole(wsId, db.activeUserId)) {
              return { data: null, error: null };
            }
            return { data: db.creatorProfiles.get(wsId) ?? null, error: null };
          }
          if (table === "niche_recommendations") {
            const wsId = String(filters.workspace_id);
            const found = db.niches.find(
              (n) =>
                n.workspace_id === wsId &&
                (filters.is_selected === undefined ||
                  n.is_selected === filters.is_selected)
            );
            return { data: found ?? null, error: null };
          }
          if (table === "credit_wallets") {
            const wsId = String(filters.workspace_id);
            return { data: db.wallets.get(wsId) ?? null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: (val: { data: unknown; error: null }) => unknown) => {
          if (table === "niche_recommendations") {
            const wsId = String(filters.workspace_id);
            const rows = db.niches.filter((n) => n.workspace_id === wsId);
            return Promise.resolve(resolve({ data: rows, error: null }));
          }
          if (table === "ai_provider_usage") {
            const wsId = String(filters.workspace_id);
            const rows = db.usageLogs.filter((u) => u.workspace_id === wsId);
            return Promise.resolve(resolve({ data: rows, error: null }));
          }
          if (table === "credit_transactions") {
            const walletId = String(filters.wallet_id);
            const rows = db.creditTx.filter((t) => t.wallet_id === walletId);
            return Promise.resolve(resolve({ data: rows, error: null }));
          }
          return Promise.resolve(resolve({ data: [], error: null }));
        },
        upsert: async (payload: Record<string, unknown>) => {
          if (table === "onboarding_sessions") {
            db.onboarding.set(String(payload.workspace_id), {
              id: "onb-1",
              created_at: new Date().toISOString(),
              ...payload,
            });
            return { error: null };
          }
          if (table === "creator_profiles") {
            db.creatorProfiles.set(String(payload.workspace_id), {
              id: "cp-1",
              created_at: new Date().toISOString(),
              ...payload,
            });
            return { error: null };
          }
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (col: string, val: unknown) => {
            if (table === "workspaces") {
              const cur = db.workspaces.get(String(val));
              if (cur) db.workspaces.set(String(val), { ...cur, ...patch });
            } else if (table === "onboarding_sessions" && col === "workspace_id") {
              const cur = db.onboarding.get(String(val));
              if (cur) db.onboarding.set(String(val), { ...cur, ...patch });
            } else if (table === "creator_profiles" && col === "workspace_id") {
              const cur = db.creatorProfiles.get(String(val));
              if (cur) db.creatorProfiles.set(String(val), { ...cur, ...patch });
            } else if (table === "profiles" && col === "id") {
              const cur = db.profiles.get(String(val));
              if (cur) db.profiles.set(String(val), { ...cur, ...patch });
            }
            return { error: null };
          },
        }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          if (table === "niche_recommendations") {
            rows.forEach((r, idx) => {
              db.niches.push({
                id: `00000000-0000-4000-8000-00000000010${idx + 1}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...r,
              });
            });
          }
          return { error: null };
        },
        delete: () => ({
          eq: (col1: string, val1: unknown) => ({
            eq: async (col2: string, val2: unknown) => {
              if (table === "niche_recommendations") {
                db.niches = db.niches.filter(
                  (n) => !(n[col1] === val1 && n[col2] === val2)
                );
              }
              return { error: null };
            },
          }),
        }),
      };

      return queryBuilder;
    }),
  })),
}));

import { OnboardingService } from "@/services/onboarding-service";
import { NicheDiscoveryService } from "@/services/niche-discovery-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { InsufficientCreditsError } from "@/lib/ai/types";

const MOCK_SYNTHESIS_JSON = {
  creatorDna: {
    creatorName: "Alya Finansial Muda",
    primaryNiche: "Pengelolaan Gaji Pertama",
    secondaryNiches: ["Spreadsheet Anggaran", "Kebiasaan Hemat"],
    uniqueValueProposition:
      "Panduan mengatur gaji pertama dalam 60 detik dengan studi kasus pengeluaran nyata.",
    targetAudienceSummary:
      "Karyawan tahun pertama usia 22-27 tahun yang ingin disiplin menabung.",
    toneOfVoice: ["Edukatif", "Hangat", "Jujur"],
    personalityArchetype: "The Practical Sister",
    strengths: ["Penjelasan angka sederhana", "Riset rapi"],
    tabooTopics: ["Skema cepat kaya", "Pamer saldo rekening"],
    primaryPlatforms: ["tiktok", "instagram"],
    preferredFormats: ["Video Pendek Talking Head", "Carousel Simulasi"],
  },
  audiencePersona: {
    personaName: "Nadia First-Jobber",
    ageRange: "22-27 tahun",
    occupationOrLifeStage: "Staf kantor swasta tahun pertama",
    corePainPoints: ["Gaji habis sebelum tanggal 20", "Bingung mulai dana darurat"],
    coreDesires: ["Punya tabungan stabil", "Tetap bisa menikmati hidup wajar"],
    contentConsumptionHabits: "Menonton Reels dan TikTok saat perjalanan pulang kerja",
    commonObjections: ["Merasa gaji masih terlalu kecil untuk diatur"],
    activePlatforms: ["tiktok", "instagram"],
  },
  creatorAssessment: {
    readinessLevel: "ready_to_launch",
    summary:
      "Fondasi keahlian praktis sudah kuat; tantangan utama adalah menjaga ritme rekaman sederhana.",
    dimensions: [
      { dimension: "Kejelasan Niche", score: 8, rationale: "Masalah audiens sangat spesifik" },
      { dimension: "Kapasitas Konsistensi", score: 7, rationale: "4-6 jam/minggu cukup untuk 3 konten" },
      { dimension: "Kesiapan Produksi", score: 7, rationale: "Smartphone memadai untuk format edukasi" },
      { dimension: "Kesiapan Monetisasi", score: 6, rationale: "Cocok mulai dari produk digital ringan" },
    ],
    topStrengths: ["Topik dekat dengan keseharian", "Gaya komunikasi membumi"],
    keyBottlenecks: ["Perfeksionisme saat rekaman awal"],
    recommendedFocus: "Fokus terbitkan 3 video pendek per minggu tanpa over-editing.",
  },
  monetizationRecommendations: [
    {
      pathwayName: "Template Tracker Gaji Bulanan",
      modelType: "digital_products",
      fitExplanation: "Selaras dengan keahlian spreadsheet dan masalah audiens.",
      readinessStage: "setelah_konsisten_30_hari",
      prerequisites: ["Bangun minimal 10-12 konten edukasi gratis", "Uji validasi kebutuhan audiens"],
      firstActionStep: "Buat versi mini gratis sebagai bahan demonstrasi di video.",
      realisticDisclaimer:
        "Hasil penjualan bergantung pada kepercayaan audiens dan konsistensi distribusi konten.",
    },
    {
      pathwayName: "Afiliasi Buku Keuangan & Alat Kerja",
      modelType: "affiliate_commission",
      fitExplanation: "Relevan dengan minat literasi keuangan tanpa perlu stok barang.",
      readinessStage: "mulai_sekarang",
      prerequisites: ["Hanya rekomendasikan buku yang benar-benar sudah dibaca"],
      firstActionStep: "Susun daftar 3 buku yang paling membantu perjalanan finansial Anda.",
      realisticDisclaimer:
        "Komisi afiliasi bersifat bertahap dan tidak menjanjikan penghasilan tetap.",
    },
  ],
  roadmap30Days: [1, 2, 3, 4].map((w) => ({
    weekNumber: w,
    theme: `Minggu ${w}: Eksekusi Terukur`,
    weeklyGoal: "Menerbitkan 3 konten edukasi terstruktur",
    postingCadence: "3x per minggu",
    tasks: [
      {
        id: `w${w}_t1`,
        dayRange: "Hari 1-3",
        title: `Riset & Rekam Konten Minggu ${w}`,
        contentFormat: "Short Video 45s",
        actionDescription: "Tulis 1 masalah spesifik audiens lalu rekam menggunakan HP.",
        deliverableOutput: "1 video siap unggah",
        completed: false,
      },
      {
        id: `w${w}_t2`,
        dayRange: "Hari 4-7",
        title: `Evaluasi Respons Audiens Minggu ${w}`,
        contentFormat: "Carousel",
        actionDescription: "Rangkum pertanyaan kolom komentar menjadi slide ringkas.",
        deliverableOutput: "1 carousel edukasi",
        completed: false,
      },
    ],
  })),
};

const MOCK_NICHE_BATCH = {
  recommendations: [
    {
      nicheTitle: "Budgeting Gaji Pertama Tanpa Stres",
      explanation: "Sangat selaras dengan Creator DNA Alya dan kebutuhan pekerja muda.",
      audience: "First jobber usia 22-27 tahun di kota besar",
      contentOpportunities: [
        {
          angleTitle: "Pembagian gaji H+1 gajian",
          formatSuggestion: "Reels 45s",
          whyAudienceCares: "Mencegah belanja impulsif awal bulan",
        },
        {
          angleTitle: "Simulasi dana darurat bertahap",
          formatSuggestion: "Carousel",
          whyAudienceCares: "Target terasa masuk akal",
        },
        {
          angleTitle: "Audit pengeluaran kopi & langganan",
          formatSuggestion: "TikTok Talking Head",
          whyAudienceCares: "Dekat dengan keseharian",
        },
      ],
      competitionAssessment: {
        competitionDensity: "moderate",
        differentiationStrategy: "Gunakan simulasi angka realistis tanpa menghakimi gaya hidup",
        entryBarrierSummary: "Cukup smartphone dan konsistensi cerita",
        assessmentMethodology: "Evaluasi kualitatif keselarasan profil kreator",
      },
      requiredSkills: ["Komunikasi runtut", "Simulasi anggaran dasar"],
      monetizationPossibilities: [
        {
          channel: "Template Anggaran Digital",
          prerequisiteNote: "Efektif setelah audiens rutin meminta file simulasi",
        },
        {
          channel: "Afiliasi Buku Finansial",
          prerequisiteNote: "Membutuhkan ulasan jujur bab pilihan",
        },
      ],
      confidenceLevel: "high",
      confidenceScore: 88,
      supportingEvidence: {
        profileFitSignals: ["Sesuai skill spreadsheet", "Sesuai waktu 3-6 jam/minggu"],
        marketObservationNote: "Masalah pengelolaan gaji berulang setiap bulan",
        dataAvailabilityStatus:
          "Belum ada data statistik pasar eksternal real-time; evaluasi berbasis profil",
      },
    },
    {
      nicheTitle: "Produktivitas Kerja & Karier Tahun Pertama",
      explanation: "Memanfaatkan kemampuan sistem kerja rapi untuk staf baru.",
      audience: "Fresh graduate dan staf junior",
      contentOpportunities: [
        {
          angleTitle: "Checklist minggu pertama kerja",
          formatSuggestion: "Carousel",
          whyAudienceCares: "Mengurangi kecemasan kerja baru",
        },
        {
          angleTitle: "Cara merapikan tugas harian",
          formatSuggestion: "Short Video",
          whyAudienceCares: "Bantu selesai tepat waktu",
        },
        {
          angleTitle: "Komunikasi efektif ke manajer",
          formatSuggestion: "Talking Head",
          whyAudienceCares: "Langsung terpakai di kantor",
        },
      ],
      competitionAssessment: {
        competitionDensity: "moderate",
        differentiationStrategy: "Sudut pandang teman sebaya yang praktis",
        entryBarrierSummary: "Rendah, fokus pada pengalaman kerja nyata",
        assessmentMethodology: "Evaluasi kualitatif berbasis profil",
      },
      requiredSkills: ["Penataan alur kerja", "Storytelling"],
      monetizationPossibilities: [
        {
          channel: "Template Notion/Excel Kerja",
          prerequisiteNote: "Perlu contoh pemakaian nyata",
        },
        {
          channel: "Afiliasi Perlengkapan Meja Kerja",
          prerequisiteNote: "Gunakan barang yang dipakai sendiri",
        },
      ],
      confidenceLevel: "medium",
      confidenceScore: 79,
      supportingEvidence: {
        profileFitSignals: ["Keahlian organisasi data", "Audiens sebaya"],
        marketObservationNote: "Kebutuhan adaptasi dunia kerja selalu relevan",
        dataAvailabilityStatus: "Evaluasi kualitatif berbasis profil kreator",
      },
    },
    {
      nicheTitle: "Kebiasaan Hemat Anak Kos Perkotaan",
      explanation: "Sub-topik sangat spesifik dengan kedekatan keseharian tinggi.",
      audience: "Perantau muda dan mahasiswa akhir",
      contentOpportunities: [
        {
          angleTitle: "Belanja mingguan terencana",
          formatSuggestion: "Short Video",
          whyAudienceCares: "Menghemat pengeluaran makan",
        },
        {
          angleTitle: "Catat biaya tak terduga kos",
          formatSuggestion: "Carousel",
          whyAudienceCares: "Menghindari defisit akhir bulan",
        },
        {
          angleTitle: "Perbandingan masak vs beli",
          formatSuggestion: "Reels",
          whyAudienceCares: "Angka realistis",
        },
      ],
      competitionAssessment: {
        competitionDensity: "low",
        differentiationStrategy: "Pendekatan data pengeluaran rapi namun santai",
        entryBarrierSummary: "Sangat mudah direkam dari kamar kos/rumah",
        assessmentMethodology: "Evaluasi kualitatif berbasis profil",
      },
      requiredSkills: ["Pencatatan rapi", "Narasi santai"],
      monetizationPossibilities: [
        {
          channel: "Afiliasi Peralatan Kos Fungsional",
          prerequisiteNote: "Fokus barang awet dan hemat ruang",
        },
        {
          channel: "Mini Guide Pengaturan Uang Kos",
          prerequisiteNote: "Setelah komunitas terbentuk",
        },
      ],
      confidenceLevel: "medium",
      confidenceScore: 76,
      supportingEvidence: {
        profileFitSignals: ["Mudah direkam dengan HP", "Beban produksi ringan"],
        marketObservationNote: "Relatable bagi perantau muda",
        dataAvailabilityStatus: "Evaluasi kualitatif berbasis profil kreator",
      },
    },
  ],
};

describe("Phase 2 End-to-End Integration: Onboarding, DNA, Niche, Roadmap, Context & Billing", () => {
  beforeEach(() => {
    resetDb();
  });

  it("completes adaptive interview, edits answers, synthesizes editable DNA, saves & toggles roadmap, selects niche, reuses context, and tracks usage/credits", async () => {
    const capturedPrompts: StructuredTextRequest[] = [];

    const mockGeminiProvider: TextGenerationProvider = {
      name: "gemini",
      isConfigured: () => true,
      generateStructuredJson: async (req): Promise<StructuredTextResponse> => {
        capturedPrompts.push(req);
        let payload: unknown;
        if (req.schemaName === "AdaptiveQuestionBatch") {
          payload = {
            coachSummary: "Profil Alya sangat cocok untuk edukasi gaji pertama yang membumi.",
            questions: [
              {
                id: "q_ai_1",
                question: "Kesalahan keuangan apa yang dulu paling sering Anda alami di gaji pertama?",
                whyItMatters: "Pengalaman pribadi membuat cerita jauh lebih dipercaya.",
                targetDimension: "differentiation",
                placeholder: "Contoh: Lupa menyisihkan dana darurat di awal bulan",
              },
              {
                id: "q_ai_2",
                question: "Berapa durasi rekaman sekali duduk yang paling nyaman bagi Anda?",
                whyItMatters: "Menyesuaikan batch produksi mingguan.",
                targetDimension: "production_constraint",
                placeholder: "Contoh: 60 menit tiap Sabtu pagi",
              },
              {
                id: "q_ai_3",
                question: "Pertanyaan keuangan apa yang sering ditanyakan teman kantor Anda?",
                whyItMatters: "Menjadi daftar topik 2 minggu pertama.",
                targetDimension: "audience_pain_point",
                placeholder: "Contoh: Cara bagi pos gaji UMR",
              },
            ],
          };
        } else if (req.schemaName === "CreatorIntelligenceSynthesis") {
          payload = MOCK_SYNTHESIS_JSON;
        } else {
          payload = MOCK_NICHE_BATCH;
        }

        return {
          rawText: JSON.stringify(payload),
          usage: {
            provider: "gemini",
            modelId: "gemini-3.8-flash",
            promptTokens: 620,
            completionTokens: 980,
            totalTokens: 1600,
            estimatedCostUsd: 0.002636,
            durationMs: 940,
          },
        };
      },
    };

    // 1. Save Core Onboarding Answers & verify baseline adaptive questions
    const coreRes = await OnboardingService.saveCoreAnswers(WS_A, USER_A, {
      creatorMode: "affiliate",
      interests: ["Keuangan Gaji Pertama", "Spreadsheet"],
      skills: ["Excel", "Komunikasi Runtut"],
      experience: "complete_beginner",
      experienceNotes: "",
      availableTime: "3_to_6_hours_weekly",
      availableEquipment: "smartphone_only",
      equipmentNotes: "",
      preferredContentFormat: ["short_video_talking_head"],
      primaryPlatforms: ["tiktok", "instagram"],
      targetAudience: "Pekerja muda 22-27 tahun",
      goals: "Konsisten upload 3 video edukasi per minggu",
      monetizationPreferences: ["affiliate_commission", "digital_products"],
    });
    expect(coreRes.adaptiveQuestions.length).toBeGreaterThanOrEqual(3);
    expect(db.workspaces.get(WS_A)?.creator_mode).toBe("affiliate");

    // 2. Generate AI Adaptive Follow-Up Questions (1 credit: 50 -> 49)
    const aiQRes = await OnboardingService.generateAiAdaptiveQuestions(WS_A, USER_A, {
      primary: mockGeminiProvider,
    });
    expect(aiQRes.questions).toHaveLength(3);
    expect(aiQRes.remainingCredits).toBe(49);

    // 3. Save & Edit Adaptive Answers
    await OnboardingService.saveAdaptiveAnswers(WS_A, USER_A, {
      q_ai_1: "Dulu gaji selalu habis untuk jajan kecil tak tercatat.",
    });
    const editedAnswers = await OnboardingService.saveAdaptiveAnswers(WS_A, USER_A, {
      q_ai_1: "Diedit: Dulu saya tidak memisahkan rekening tabungan dan rekening harian.",
      q_ai_2: "Sabtu pagi 90 menit untuk rekam 3 video sekaligus.",
    });
    expect(editedAnswers.q_ai_1).toContain("Diedit:");

    // 4. Synthesize Creator DNA, Persona, Assessment, Monetization & 30-Day Roadmap (3 credits: 49 -> 46)
    const synthRes = await OnboardingService.synthesizeCreatorIntelligence(WS_A, USER_A, {
      primary: mockGeminiProvider,
    });
    expect(synthRes.synthesis.creatorDna.creatorName).toBe("Alya Finansial Muda");
    expect(synthRes.synthesis.roadmap30Days).toHaveLength(4);
    expect(synthRes.remainingCredits).toBe(46);

    // 5. User directly edits Creator DNA (Editable Creator DNA criterion)
    const editedDna = await OnboardingService.saveEditableCreatorDna(WS_A, USER_A, {
      ...synthRes.synthesis.creatorDna,
      creatorName: "Alya Gaji Cerdas (Edited)",
      tabooTopics: ["Pinjol ilegal", "Skema cepat kaya"],
    });
    expect(editedDna.creatorName).toBe("Alya Gaji Cerdas (Edited)");

    // 6. Toggle 30-Day Roadmap task completion & verify persistence
    const updatedWeeks = await OnboardingService.toggleRoadmapTaskCompletion(
      WS_A,
      USER_A,
      "w1_t1",
      true
    );
    expect(updatedWeeks[0]?.tasks[0]?.completed).toBe(true);

    // 7. Generate Structured Niche Recommendations (2 credits: 46 -> 44) & verify Reusable Context Injection!
    const nicheRes = await NicheDiscoveryService.generateRecommendations(WS_A, USER_A, {
      customFocusHint: "Fokus pekerja muda perkotaan",
      customProviders: { primary: mockGeminiProvider },
    });
    expect(nicheRes.recommendations).toHaveLength(3);
    expect(nicheRes.remainingCredits).toBe(44);

    // Verify NicheStrategistAgent prompt automatically reused the edited Creator DNA & Taboo Topics!
    const nichePrompt = capturedPrompts.find((p) => p.schemaName === "NicheDiscoveryBatch");
    expect(nichePrompt?.userPrompt).toContain("Alya Gaji Cerdas (Edited)");
    expect(nichePrompt?.userPrompt).toContain("Pinjol ilegal");

    // 8. Select Preferred Niche & verify sync to Creator DNA + Reusable Context
    const chosenId = nicheRes.recommendations[0]!.id;
    const chosenTitle = await NicheDiscoveryService.selectPreferredNiche(
      WS_A,
      USER_A,
      chosenId
    );
    expect(chosenTitle).toBe("Budgeting Gaji Pertama Tanpa Stres");

    const reusableCtx = await CreatorContextService.getWorkspaceCreatorContext(
      WS_A,
      USER_A
    );
    expect(reusableCtx.selectedNiche?.nicheTitle).toBe(
      "Budgeting Gaji Pertama Tanpa Stres"
    );
    expect(reusableCtx.creatorDna?.primaryNiche).toBe(
      "Budgeting Gaji Pertama Tanpa Stres"
    );

    // 9. Verify Usage & Cost Telemetry Tracking
    const usageOverview = await UsageBillingService.getWorkspaceUsageOverview(
      WS_A,
      USER_A
    );
    expect(usageOverview.balance).toBe(44);
    expect(usageOverview.recentUsage).toHaveLength(3);
    expect(usageOverview.totalTokensUsedRecent).toBe(4800);
    expect(usageOverview.totalCostUsdRecent).toBeGreaterThan(0);

    // 10. Cross-tenant isolation: User B cannot access WS_A context or select WS_A niche
    db.activeUserId = USER_B;
    await expect(
      CreatorContextService.getWorkspaceCreatorContext(WS_A, USER_B)
    ).rejects.toThrow(/Akses ditolak/i);

    await expect(
      NicheDiscoveryService.selectPreferredNiche(WS_A, USER_B, chosenId)
    ).rejects.toThrow(/Akses ditolak/i);
  });

  it("falls back cleanly to secondary provider on primary failure and blocks execution when credits are insufficient", async () => {
    db.activeUserId = USER_A;

    await OnboardingService.saveCoreAnswers(WS_A, USER_A, {
      creatorMode: "creator",
      interests: ["Teknologi AI"],
      skills: ["Menulis"],
      experience: "complete_beginner",
      experienceNotes: "",
      availableTime: "3_to_6_hours_weekly",
      availableEquipment: "smartphone_only",
      equipmentNotes: "",
      preferredContentFormat: ["short_video_talking_head"],
      primaryPlatforms: ["tiktok"],
      targetAudience: "Mahasiswa",
      goals: "Belajar membuat konten",
      monetizationPreferences: ["undecided_explore_first"],
    });

    const failingPrimary: TextGenerationProvider = {
      name: "gemini",
      isConfigured: () => true,
      generateStructuredJson: async () => {
        throw new Error("Simulated upstream 503");
      },
    };

    const workingFallback: TextGenerationProvider = {
      name: "openai",
      isConfigured: () => true,
      generateStructuredJson: async () => ({
        rawText: JSON.stringify({
          coachSummary: "Fallback berhasil memproses profil Anda.",
          questions: [
            {
              id: "fb_1",
              question: "Alat AI apa yang paling sering Anda pakai kuliah?",
              whyItMatters: "Menentukan sub-topik awal.",
              targetDimension: "niche_specificity",
              placeholder: "Contoh: Gemini untuk rangkuman jurnal",
            },
            {
              id: "fb_2",
              question: "Kapan waktu luang kuliah Anda untuk merekam?",
              whyItMatters: "Menjaga jadwal realistis.",
              targetDimension: "production_constraint",
              placeholder: "Contoh: Jumat sore",
            },
            {
              id: "fb_3",
              question: "Kesulitan apa yang dialami teman kampus soal AI?",
              whyItMatters: "Menajamkan target audiens.",
              targetDimension: "audience_pain_point",
              placeholder: "Contoh: Bingung cara tulis prompt",
            },
          ],
        }),
        usage: {
          provider: "openai",
          modelId: "gpt-4o-mini",
          promptTokens: 400,
          completionTokens: 500,
          totalTokens: 900,
          estimatedCostUsd: 0.00036,
          durationMs: 700,
        },
      }),
    };

    const fbRes = await OnboardingService.generateAiAdaptiveQuestions(WS_A, USER_A, {
      primary: failingPrimary,
      fallback: workingFallback,
    });
    expect(fbRes.questions).toHaveLength(3);
    expect(db.usageLogs.at(-1)?.status).toBe("fallback_success");

    // Exhaust credits and verify pre-execution guard blocks LLM call
    db.wallets.get(WS_A)!.balance = 1;
    await expect(
      OnboardingService.synthesizeCreatorIntelligence(WS_A, USER_A, {
        primary: workingFallback,
      })
    ).rejects.toBeInstanceOf(InsufficientCreditsError);
  });
});
