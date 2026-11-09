import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  StructuredTextRequest,
  StructuredTextResponse,
  TextGenerationProvider,
} from "@/lib/ai/types";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const WS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Row = Record<string, unknown>;

interface Phase3MockDb {
  activeUserId: string;
  tables: Record<string, Row[]>;
  wallets: Map<
    string,
    { id: string; workspace_id: string; balance: number; monthly_allowance: number }
  >;
  members: Array<{ workspace_id: string; user_id: string; role: string }>;
}

let db: Phase3MockDb;

function hasRole(wsId: string, uid: string, minRole = "viewer"): boolean {
  const m = db.members.find((x) => x.workspace_id === wsId && x.user_id === uid);
  if (!m) return false;
  if (minRole === "viewer" || minRole === "member") return true;
  if (minRole === "editor") return ["owner", "admin", "editor"].includes(m.role);
  if (minRole === "admin") return ["owner", "admin"].includes(m.role);
  if (minRole === "owner") return m.role === "owner";
  return false;
}

function resetDb() {
  const now = "2026-10-30T15:00:00.000Z";
  db = {
    activeUserId: USER_A,
    members: [
      { workspace_id: WS_A, user_id: USER_A, role: "owner" },
      { workspace_id: WS_B, user_id: USER_B, role: "owner" },
    ],
    wallets: new Map([
      [WS_A, { id: "wal-a", workspace_id: WS_A, balance: 50, monthly_allowance: 50 }],
      [WS_B, { id: "wal-b", workspace_id: WS_B, balance: 50, monthly_allowance: 50 }],
    ]),
    tables: {
      profiles: [{ id: USER_A, full_name: "Nadia Kreator", onboarding_completed: true }],
      workspaces: [
        {
          id: WS_A,
          name: "Nadia Studio",
          slug: "nadia-studio",
          creator_mode: "creator",
          deleted_at: null,
        },
        {
          id: WS_B,
          name: "Bima Studio",
          slug: "bima-studio",
          creator_mode: "business",
          deleted_at: null,
        },
      ],
      workspace_settings: [
        {
          workspace_id: WS_A,
          default_language: "id",
          default_ai_model: "gemini-3.8-flash",
        },
      ],
      onboarding_sessions: [],
      creator_profiles: [
        {
          id: randomUUID(),
          workspace_id: WS_A,
          creator_name: "Nadia Finansial Muda",
          primary_niche: "Keuangan Pribadi Gaji Pertama",
          secondary_niches: ["Dana Darurat", "Budgeting Bulanan"],
          tone_of_voice: ["Hangat", "Lugas"],
          personality_archetype: "The Pragmatic Mentor",
          unique_value_proposition:
            "Panduan mengelola gaji pertama dalam 5 menit menggunakan template sederhana.",
          target_audience_summary: "Pekerja baru usia 22-27 tahun yang ingin mengatur arus kas bulanan.",
          strengths: ["Simulasi spreadsheet jelas", "Bahasa bebas jargon"],
          taboo_topics: ["Kripto spekulatif", "Pamer saldo"],
          primary_platforms: ["tiktok", "linkedin"],
          preferred_formats: ["short_video_talking_head"],
          audience_persona: {
            personaName: "Raka Freshgrad",
            ageRange: "22-27 tahun",
            occupationOrLifeStage: "Karyawan baru kota besar Indonesia",
            corePainPoints: ["Gaji habis pertengahan bulan", "Bingung mulai dana darurat"],
            coreDesires: ["Punya tabungan stabil tanpa hidup pelit", "Bebas utang konsumtif"],
            contentConsumptionHabits: "Menonton video pendek saat jam istirahat kantor",
            commonObjections: ["Takut rumus keuangan rumit"],
            activePlatforms: ["tiktok", "linkedin"],
          },
          assessment_scores: null,
          monetization_recommendations: [],
          roadmap_30_days: [],
          updated_at: now,
        },
      ],
      niche_recommendations: [
        {
          id: randomUUID(),
          workspace_id: WS_A,
          is_selected: true,
          niche_title: "Budgeting Gaji Pertama",
          explanation: "Membantu karyawan muda menyusun arus kas bulanan yang realistis.",
          audience: "Pekerja usia 22-27 tahun",
          content_opportunities: [
            {
              angleTitle: "Rumus pembagian pos gaji",
              formatSuggestion: "Video pendek 45 detik",
              whyAudienceCares: "Langsung bisa dipraktikkan saat gajian",
            },
            {
              angleTitle: "Audit pengeluaran bocor halus",
              formatSuggestion: "Studi kasus",
              whyAudienceCares: "Relatable dengan keseharian kantor",
            },
            {
              angleTitle: "Cara menyusun dana darurat bertahap",
              formatSuggestion: "Carousel langkah praktis",
              whyAudienceCares: "Mengurangi kecemasan finansial",
            },
          ],
          competition_assessment: {
            competitionDensity: "moderate",
            differentiationStrategy: "Fokus simulasi angka gaji UMR-menengah nyata",
            entryBarrierSummary: "Konsistensi studi kasus",
            assessmentMethodology: "Evaluasi kualitatif ruang konten",
          },
          required_skills: ["Komunikasi terstruktur", "Spreadsheet dasar"],
          monetization_possibilities: [
            { channel: "Template Budgeting Digital", prerequisiteNote: "Kepercayaan audiens" },
            { channel: "Edukasi Brand Finansial Resmi", prerequisiteNote: "Portofolio bersih" },
          ],
          confidence_level: "high",
          confidence_score: 86,
          supporting_evidence: {
            profileFitSignals: ["Keahlian spreadsheet", "Target audiens spesifik"],
            marketObservationNote: "Kebutuhan literasi gaji pertama relevan setiap tahun",
            dataAvailabilityStatus: "Evaluasi kualitatif berbasis kecocokan profil kreator",
          },
          updated_at: now,
        },
      ],
      brand_profiles: [],
      research_reports: [],
      research_sources: [],
      competitor_profiles: [],
      content_strategies: [],
      content_pillars: [],
      content_ideas: [],
      content_items: [],
      scripts: [],
      ai_provider_usage: [],
      credit_transactions: [],
    },
  };
}

function matchesFilters(row: Row, filters: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(filters)) {
    if (row[k] !== v) return false;
  }
  return true;
}

function filterTenantRows(table: string, rows: Row[]): Row[] {
  if (table === "profiles") return rows;
  if (table === "workspaces") {
    return rows.filter((r) => hasRole(String(r.id), db.activeUserId));
  }
  return rows.filter(
    (r) => !r.workspace_id || hasRole(String(r.workspace_id), db.activeUserId)
  );
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: vi.fn(async (fnName: string, args: Record<string, unknown>) => {
      if (fnName === "has_workspace_access") {
        return {
          data: hasRole(
            String(args.ws_id),
            db.activeUserId,
            String(args.minimum_role || "viewer")
          ),
          error: null,
        };
      }

      if (fnName === "record_ai_usage_and_deduct_credits") {
        const wsId = String(args.target_workspace_id);
        if (!hasRole(wsId, db.activeUserId, "editor")) {
          return { data: null, error: { message: "Unauthorized" } };
        }
        const wallet = db.wallets.get(wsId)!;
        const status = String(args.p_status || "success");
        const charge =
          status === "success" || status === "fallback_success"
            ? Number(args.p_credits_to_deduct)
            : 0;
        if (charge > 0 && wallet.balance < charge) {
          return { data: null, error: { message: "Insufficient credits" } };
        }
        wallet.balance -= charge;
        const usageId = randomUUID();
        db.tables.ai_provider_usage.push({
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
        return {
          data: {
            agent_run_id: randomUUID(),
            usage_id: usageId,
            credits_deducted: charge,
            remaining_balance: wallet.balance,
          },
          error: null,
        };
      }

      if (fnName === "activate_content_strategy") {
        const wsId = String(args.target_workspace_id);
        const stratId = String(args.target_strategy_id);
        if (!hasRole(wsId, db.activeUserId, "editor")) {
          return { data: null, error: { message: "Unauthorized" } };
        }
        for (const s of db.tables.content_strategies) {
          if (s.workspace_id === wsId) {
            s.is_active = s.id === stratId;
          }
        }
        return { data: stratId, error: null };
      }

      if (fnName === "save_script_version") {
        const wsId = String(args.target_workspace_id);
        const itemId = String(args.target_content_item_id);
        if (!hasRole(wsId, db.activeUserId, "editor")) {
          return { data: null, error: { message: "Unauthorized" } };
        }
        const existing = db.tables.scripts.filter(
          (s) => s.workspace_id === wsId && s.content_item_id === itemId
        );
        const nextVer =
          existing.reduce((max, s) => Math.max(max, Number(s.version)), 0) + 1;
        for (const s of existing) {
          s.is_current = false;
        }
        const newScript: Row = {
          id: randomUUID(),
          content_item_id: itemId,
          workspace_id: wsId,
          version: nextVer,
          target_platform: args.p_target_platform,
          framework: args.p_framework,
          opening_hook: args.p_opening_hook,
          body_content: args.p_body_content,
          closing_cta: args.p_closing_cta,
          visual_and_audio_cues: args.p_visual_cues,
          estimated_duration_seconds: args.p_duration_seconds,
          is_current: true,
          created_by: db.activeUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.tables.scripts.push(newScript);
        return {
          data: { script_id: newScript.id, version: nextVer },
          error: null,
        };
      }

      return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
    }),

    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};

      const makeSelectChain = () => {
        const chain = {
          select: () => chain,
          eq: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          },
          is: (col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          },
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => {
            if (table === "credit_wallets") {
              const wsId = String(filters.workspace_id);
              return { data: db.wallets.get(wsId) ?? null, error: null };
            }
            const rows = filterTenantRows(table, db.tables[table] ?? []).filter((r) =>
              matchesFilters(r, filters)
            );
            return { data: rows[0] ?? null, error: null };
          },
          single: async () => {
            if (table === "workspace_members") {
              const wsId = String(filters.workspace_id);
              const uid = String(filters.user_id);
              const m = db.members.find(
                (x) => x.workspace_id === wsId && x.user_id === uid
              );
              const ws = db.tables.workspaces.find((w) => w.id === wsId);
              if (!m || !ws) return { data: null, error: { message: "Not found" } };
              return { data: { role: m.role, workspace: ws }, error: null };
            }
            const res = await chain.maybeSingle();
            if (!res.data) return { data: null, error: { message: "Row not found" } };
            return res;
          },
          then: (resolve: (val: { data: Row[]; error: null }) => unknown) => {
            const rows = filterTenantRows(table, db.tables[table] ?? []).filter((r) =>
              matchesFilters(r, filters)
            );
            return Promise.resolve(resolve({ data: rows, error: null }));
          },
        };
        return chain;
      };

      return {
        ...makeSelectChain(),

        insert: (payload: Row | Row[]) => {
          const items = Array.isArray(payload) ? payload : [payload];
          const now = new Date().toISOString();
          const inserted: Row[] = [];
          for (const item of items) {
            if (item.workspace_id && !hasRole(String(item.workspace_id), db.activeUserId, "editor")) {
              const errResp = { data: null, error: { message: "RLS insert denied" } };
              return {
                select: () => ({
                  single: async () => errResp,
                  then: (res: (v: typeof errResp) => unknown) => Promise.resolve(res(errResp)),
                }),
                then: (res: (v: { error: { message: string } }) => unknown) =>
                  Promise.resolve(res({ error: { message: "RLS insert denied" } })),
              };
            }
            const row: Row = {
              id: (item.id as string) || randomUUID(),
              created_at: now,
              updated_at: now,
              ...item,
            };
            db.tables[table].push(row);
            inserted.push(row);
          }

          return {
            select: () => ({
              single: async () => ({ data: inserted[0] ?? null, error: null }),
              then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
                Promise.resolve(resolve({ data: inserted, error: null })),
            }),
            then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
              Promise.resolve(resolve({ data: inserted, error: null })),
          };
        },

        upsert: async (payload: Row, opts?: { onConflict?: string }) => {
          const conflictCol = opts?.onConflict || "workspace_id";
          const wsId = String(payload.workspace_id);
          if (!hasRole(wsId, db.activeUserId, "editor")) {
            return { error: { message: "RLS upsert denied" } };
          }
          const idx = db.tables[table].findIndex(
            (r) => r[conflictCol] === payload[conflictCol]
          );
          const now = new Date().toISOString();
          if (idx >= 0) {
            db.tables[table][idx] = {
              ...db.tables[table][idx],
              ...payload,
              updated_at: now,
            };
          } else {
            db.tables[table].push({
              id: randomUUID(),
              created_at: now,
              updated_at: now,
              ...payload,
            });
          }
          return { error: null };
        },

        update: (patch: Row) => {
          const updFilters: Record<string, unknown> = {};
          const updChain = {
            eq: (col: string, val: unknown) => {
              updFilters[col] = val;
              return updChain;
            },
            select: () => ({
              single: async () => {
                const target = filterTenantRows(table, db.tables[table]).find((r) =>
                  matchesFilters(r, updFilters)
                );
                if (!target) return { data: null, error: { message: "Update target missing" } };
                Object.assign(target, patch, { updated_at: new Date().toISOString() });
                return { data: target, error: null };
              },
            }),
            then: (resolve: (v: { error: null }) => unknown) => {
              const targets = filterTenantRows(table, db.tables[table]).filter((r) =>
                matchesFilters(r, updFilters)
              );
              for (const t of targets) {
                Object.assign(t, patch, { updated_at: new Date().toISOString() });
              }
              return Promise.resolve(resolve({ error: null }));
            },
          };
          return updChain;
        },

        delete: () => {
          const delFilters: Record<string, unknown> = {};
          const delChain = {
            eq: (col: string, val: unknown) => {
              delFilters[col] = val;
              return delChain;
            },
            then: (resolve: (v: { error: null }) => unknown) => {
              db.tables[table] = db.tables[table].filter(
                (r) =>
                  !(
                    (!r.workspace_id ||
                      hasRole(String(r.workspace_id), db.activeUserId, "editor")) &&
                    matchesFilters(r, delFilters)
                  )
              );
              return Promise.resolve(resolve({ error: null }));
            },
          };
          return delChain;
        },
      };
    }),
  })),
}));

import { ResearchService } from "@/services/research-service";
import { StrategyService } from "@/services/strategy-service";
import { ContentEngineService } from "@/services/content-engine-service";
import { CreatorContextService } from "@/services/creator-context-service";

function buildDeterministicPhase3Provider(
  capturedRequests: StructuredTextRequest[]
): TextGenerationProvider {
  return {
    name: "gemini",
    isConfigured: () => true,
    generateStructuredJson: async (
      req: StructuredTextRequest
    ): Promise<StructuredTextResponse> => {
      capturedRequests.push(req);

      if (req.schemaName === "research_synthesis_dossier") {
        // Notice: includes 1 real grounded source URL AND 1 hallucinated unverified URL to prove stripping!
        const payload = {
          title: "Dossier Riset Literasi Gaji Pertama & Dana Darurat",
          summary:
            "Audiens pekerja muda mencari langkah pembagian gaji yang sederhana tanpa rumus akuntansi kompleks.",
          verifiedFacts: [
            {
              fact: "Publikasi OJK menyoroti pentingnya literasi pengelolaan keuangan dasar bagi pekerja usia produktif.",
              sourceUrls: ["https://ojk.go.id/id/berita-dan-kegiatan/literasi-keuangan-muda"],
              confidence: "high",
            },
            {
              fact: "Klaim yang mengutip URL fiktif harus otomatis dipindahkan ke interpretasi AI.",
              sourceUrls: ["https://situs-halusinasi-tidak-terdaftar.example/artikel"],
              confidence: "low",
            },
          ],
          aiInterpretations: [
            {
              interpretation:
                "Simulasi pembagian gaji bulanan dalam 3 pos lebih mudah dieksekusi pemula dibanding 10 kategori anggaran.",
              reasoningBasis: "Selaras dengan pain point persona Raka Freshgrad.",
              confidence: "high",
            },
            {
              interpretation:
                "Format layar spreadsheet nyata meningkatkan kredibilitas dibanding sekadar monolog opini.",
              reasoningBasis: "Memanfaatkan keahlian spreadsheet pada Creator DNA.",
              confidence: "medium",
            },
          ],
          trendClaims: [
            {
              claim: "Topik literasi dana darurat pekerja baru dibahas pada kanal edukasi publik.",
              directionOrPattern: "Konsisten relevan setiap siklus tanggal gajian bulanan.",
              evidenceStatus: "verified_by_sources",
              supportingSourceUrls: [
                "https://ojk.go.id/id/berita-dan-kegiatan/literasi-keuangan-muda",
              ],
              confidenceLevel: "high",
              dataLimitation: "Berdasarkan rilis edukasi publik, bukan metrik impresi internal TikTok.",
            },
            {
              claim: "Pola klaim tanpa sumber terverifikasi harus diturunkan statusnya.",
              directionOrPattern: "Pola kualitatif pengamatan konten pendek.",
              evidenceStatus: "verified_by_sources",
              supportingSourceUrls: [
                "https://situs-halusinasi-tidak-terdaftar.example/artikel",
              ],
              confidenceLevel: "low",
              dataLimitation: "Tidak ada sumber langsung yang cocok di indeks.",
            },
          ],
          audienceInsights: [
            {
              segmentPainOrDesire: "Bingung menentukan nominal awal tabungan darurat dari gaji pertama.",
              contentBehaviorNote: "Menyimpan konten simulasi angka nyata untuk dibuka kembali saat gajian.",
              evidenceBasis: "Persona Raka Freshgrad & konteks edukasi finansial dasar.",
            },
          ],
          competitorInsights: [
            {
              competitorHandleOrGroup: "@uangrapi.id",
              observedStrength: "Visual infografis bersih pada pembukaan video.",
              contentGapOpportunity:
                "Jarang menampilkan contoh simulasi untuk rentang gaji UMR daerah.",
              evidenceBasis: "Catatan profil kompetitor workspace.",
            },
          ],
          actionableRecommendations: [
            "Buat seri simulasi pembagian gaji Rp5 juta dalam 45 detik.",
            "Tampilkan tabel sederhana 3 pos pengeluaran di 3 detik pertama.",
          ],
          sourceAssessments: [
            {
              sourceUrl: "https://ojk.go.id/id/berita-dan-kegiatan/literasi-keuangan-muda",
              relevantExtract:
                "Edukasi perencanaan dana darurat dan pengelolaan arus kas pekerja muda.",
              dataLimitations: "Artikel rilis publik institusional; tanpa metrik retensi video sosial.",
              confidenceLevel: "high",
              confidenceRationale: "Domain resmi lembaga otoritas keuangan.",
            },
          ],
          dataLimitations:
            "Metrik analitik internal platform sosial tidak tersedia secara publik; angka spesifik tidak direkayasa.",
          overallConfidence: "medium",
        };

        return {
          rawText: JSON.stringify(payload),
          usage: {
            provider: "gemini",
            modelId: "gemini-3.8-flash",
            promptTokens: 780,
            completionTokens: 610,
            totalTokens: 1390,
            estimatedCostUsd: 0.0022,
            durationMs: 320,
          },
          groundingCitations: req.enableWebGrounding
            ? [
                {
                  url: "https://ojk.go.id/id/berita-dan-kegiatan/literasi-keuangan-muda",
                  title: "OJK — Literasi Keuangan Pekerja Muda",
                  citedText: "pentingnya literasi pengelolaan keuangan dasar",
                },
              ]
            : [],
          searchQueries: ["literasi gaji pertama dana darurat indonesia"],
        };
      }

      if (req.schemaName === "content_strategy_blueprint") {
        const payload = {
          title: "Strategi Finansial Gaji Pertama Q4",
          positioningStatement:
            "Mentor keuangan pragmatis yang menerjemahkan pengelolaan gaji pertama ke langkah 5 menit.",
          uniqueDifferentiator:
            "Simulasi spreadsheet realistis untuk gaji UMR-menengah tanpa menghakimi gaya hidup.",
          coreNarrative: "Tenang mengatur gaji sejak tahun pertama bekerja.",
          publishingFrequencyPerWeek: 4,
          platformDistribution: [
            {
              platform: "tiktok",
              roleInFunnel: "Penjangkauan & edukasi cepat",
              weeklyCadence: 3,
              primaryFormat: "Video vertikal layar + talking head 45 detik",
              adaptationRule: "Buka langsung dengan masalah kebocoran gaji di 2 detik awal.",
            },
            {
              platform: "linkedin",
              roleInFunnel: "Kredibilitas profesional & diskusi karier awal",
              weeklyCadence: 1,
              primaryFormat: "Postingan studi kasus terstruktur",
              adaptationRule: "Jabarkan kerangka pemikiran dalam paragraf pendek reflektif.",
            },
          ],
          opportunityScores: [
            {
              topicOrAngle: "Simulasi Gaji Rp5 Juta Tanpa Utang Konsumtif",
              targetPlatform: "tiktok",
              demandSignal: "Keluhan umum gaji habis tengah bulan pada pekerja baru.",
              competitionDensity: "medium",
              creatorFitScore: 90,
              opportunityScore: 85,
              scoringRationale: "Sesuai keahlian spreadsheet Nadia dan kebutuhan persona Raka.",
              evidenceSourceNote: "Merujuk dossier literasi keuangan pekerja muda.",
            },
            {
              topicOrAngle: "Cara Menyusun Dana Darurat 3x Pengeluaran Wajib",
              targetPlatform: "tiktok",
              demandSignal: "Kebingungan membedakan dana darurat vs tabungan liburan.",
              competitionDensity: "medium",
              creatorFitScore: 88,
              opportunityScore: 83,
              scoringRationale: "Mudah divisualisasikan dengan tabel bertahap.",
              evidenceSourceNote: "Rujukan OJK pada dossier riset workspace.",
            },
            {
              topicOrAngle: "Kesalahan Finansial Tahun Pertama Kerja",
              targetPlatform: "linkedin",
              demandSignal: "Relevan bagi fresh graduate di jaringan profesional.",
              competitionDensity: "low",
              creatorFitScore: 84,
              opportunityScore: 80,
              scoringRationale: "Membangun diskusi reflektif antar-profesional muda.",
              evidenceSourceNote: "Analisis celah konten kompetitor.",
            },
          ],
          pillars: [
            {
              name: "Simulasi Gaji Nyata",
              description: "Bedah alokasi gaji bulanan dengan angka realistis.",
              objective: "educate",
              ratioPercentage: 45,
              exampleTopics: ["Alokasi gaji Rp5 juta", "Pos gajian otomatis"],
              recommendedFormats: ["Video vertikal 45 detik"],
              colorCode: "#4F46E5",
            },
            {
              name: "Audit Bocor Halus",
              description: "Identifikasi kebiasaan belanja kecil yang menggerus tabungan.",
              objective: "engage",
              ratioPercentage: 30,
              exampleTopics: ["Biaya langganan tak terpakai", "Batas jajan kopi mingguan"],
              recommendedFormats: ["Reels studi kasus"],
              colorCode: "#10B981",
            },
            {
              name: "Sistem Dana Darurat",
              description: "Panduan bertahap membangun jaring pengaman finansial.",
              objective: "trust",
              ratioPercentage: 25,
              exampleTopics: ["Target Rp3 juta pertama", "Tempat menyimpan dana darurat"],
              recommendedFormats: ["Carousel & penjelasan layar"],
              colorCode: "#F59E0B",
            },
          ],
        };

        return {
          rawText: JSON.stringify(payload),
          usage: {
            provider: "gemini",
            modelId: "gemini-3.8-flash",
            promptTokens: 820,
            completionTokens: 690,
            totalTokens: 1510,
            estimatedCostUsd: 0.0025,
            durationMs: 350,
          },
        };
      }

      if (req.schemaName === "content_idea_batch") {
        const payload = {
          batchSummary: "4 ide praktis seputar pengelolaan gaji pertama berbasis riset.",
          ideas: [
            {
              title: "Kenapa Gaji Pertama Selalu Habis di Tanggal 18?",
              hookConcept: "Bukan karena kurang besar, tapi urutan alokasinya terbalik.",
              angleType: "contrarian",
              targetPlatform: "tiktok",
              opportunityScore: 86,
              opportunityRationale: "Menjawab langsung kebingungan kas bulanan pekerja baru.",
              researchTrace: "Berdasarkan pain point Raka Freshgrad & temuan literasi arus kas.",
              suggestedPillarName: "Simulasi Gaji Nyata",
            },
            {
              title: "Simulasi Pembagian Gaji Rp5 Juta Pakai 3 Rekening",
              hookConcept: "Cukup 5 menit setiap tanggal 25 agar tabungan aman.",
              angleType: "tutorial",
              targetPlatform: "tiktok",
              opportunityScore: 88,
              opportunityRationale: "Format layar spreadsheet mudah disimpan penonton.",
              researchTrace: "Rekomendasi taktis dari dossier riset workspace.",
              suggestedPillarName: "Simulasi Gaji Nyata",
            },
            {
              title: "3 Pengeluaran Kecil Kantor yang Diam-Diam Tembus Rp900 Ribu",
              hookConcept: "Coba cek mutasi bulan lalu pada tiga pos ini.",
              angleType: "case_study",
              targetPlatform: "tiktok",
              opportunityScore: 82,
              opportunityRationale: "Memicu refleksi dan penyimpanan konten.",
              researchTrace: "Celah konten studi kasus pengeluaran harian.",
              suggestedPillarName: "Audit Bocor Halus",
            },
            {
              title: "Mitos Harus Menabung 50% Gaji Sejak Bulan Pertama",
              hookConcept: "Target terlalu ekstrem justru bikin gagal di bulan kedua.",
              angleType: "myth_busting",
              targetPlatform: "tiktok",
              opportunityScore: 80,
              opportunityRationale: "Pendekatan realistis sesuai arketipe Pragmatic Mentor.",
              researchTrace: "Batas konten realistis pada Creator DNA.",
              suggestedPillarName: "Sistem Dana Darurat",
            },
          ],
        };

        return {
          rawText: JSON.stringify(payload),
          usage: {
            provider: "gemini",
            modelId: "gemini-3.8-flash",
            promptTokens: 640,
            completionTokens: 520,
            totalTokens: 1160,
            estimatedCostUsd: 0.0019,
            durationMs: 280,
          },
        };
      }

      // Content Package Generation OR Platform Adaptation (`adapted_content_package_output`)
      const isLinkedInAdaptation = req.schemaName === "adapted_content_package_output";
      const payload = isLinkedInAdaptation
        ? {
            title: "Pelajaran Mengelola Gaji Pertama: Mengapa Sistem 3 Pos Lebih Bertahan Lama",
            contentFormat: "LinkedIn Thought Leadership Post",
            framework: "AIDA",
            openingHook:
              "Banyak rekan kerja baru menyalahkan nominal gaji saat saldo menipis di tanggal 18, padahal akar masalahnya sering ada pada urutan alokasi di hari gajian.",
            hookVariants: [
              {
                style: "Observasi Profesional",
                hookText:
                  "Satu kesalahan umum di tahun pertama bekerja adalah menabung dari sisa pengeluaran, bukan menyisihkan di awal.",
                visualCue: "Slide dokumen 4:5 ringkasan 3 pos arus kas",
              },
              {
                style: "Studi Kasus",
                hookText:
                  "Bagaimana menyusun sistem keuangan sederhana dalam 5 menit setiap tanggal gajian tanpa spreadsheet rumit.",
                visualCue: "Diagram alur pembagian rekening",
              },
              {
                style: "Reflektif",
                hookText:
                  "Disiplin finansial di awal karier lebih ditentukan oleh kemudahan sistem daripada niat semata.",
                visualCue: "Kutipan bersih di halaman pertama PDF",
              },
            ],
            bodyContent:
              "Di tahun pertama bekerja, banyak dari kita mencoba mencatat puluhan kategori pengeluaran hingga kelelahan di minggu kedua.\n\nPendekatan yang jauh lebih mudah dijaga adalah membagi arus kas ke dalam 3 pos utama begitu gaji masuk:\n1. Pos Kewajiban Tetap (kos, transportasi, makan kerja).\n2. Pos Pengaman & Tujuan (dana darurat bertahap).\n3. Pos Fleksibel Terukur.\n\nDengan memisahkan rekening sejak hari pertama, kita tidak perlu menebak sisa anggaran setiap kali bertransaksi.",
            closingCta:
              "Bagaimana cara Anda menyederhanakan pembagian anggaran di tahun pertama bekerja? Mari berbagi perspektif di kolom komentar.",
            ctaVariants: [
              "Bagikan pengalaman manajemen gaji pertama Anda di komentar.",
              "Simpan kerangka 3 pos ini sebagai pengingat siklus gajian berikutnya.",
            ],
            visualAndAudioCues: [
              {
                beatLabel: "Slide 1 Judul",
                spokenSummary: "Masalah urutan alokasi gaji pertama",
                visualDirection: "Tipografi bersih kontras tinggi 4:5",
                onScreenTextOrAudio: "Sistem 3 Pos Gaji Pertama",
              },
              {
                beatLabel: "Slide 2 Kerangka",
                spokenSummary: "Rincian 3 rekening terpisah",
                visualDirection: "Tabel ringkas 3 baris",
                onScreenTextOrAudio: "Wajib · Pengaman · Fleksibel",
              },
            ],
            estimatedDurationSeconds: 60,
            caption:
              "Mengelola gaji pertama tidak membutuhkan rumus akuntansi yang rumit.\n\nKuncinya terletak pada urutan alokasi di hari pertama gajian agar pos dana darurat dan kebutuhan pokok terlindungi lebih dulu.\n\nApa kebiasaan finansial paling membantu yang Anda pelajari di awal karier?",
            hashtags: ["#KeuanganPribadi", "#KarierMuda", "#LiterasiKeuangan"],
            hashtagTiers: {
              broad: ["#KeuanganPribadi"],
              niche: ["#LiterasiKeuangan"],
              specific: ["#GajiPertama"],
            },
            platformAdaptationNotes:
              "Diadaptasi dari naskah video pendek TikTok menjadi format tulisan profesional LinkedIn dengan paragraf ringkas, maksimal 3 tagar, dan CTA diskusi.",
          }
        : {
            title: "Simulasi 3 Rekening agar Gaji Pertama Aman Sampai Akhir Bulan",
            contentFormat: "TikTok Vertical Video 9:16",
            framework: "PAS",
            openingHook:
              "Baru tanggal 18 tapi gaji pertama sudah tinggal sisa ongkos? Masalahnya ada di urutan potongnya!",
            hookVariants: [
              {
                style: "Contrarian",
                hookText: "Jangan menabung dari sisa gaji di akhir bulan kalau tidak mau selalu nol.",
                visualCue: "Tampilkan layar spreadsheet sebelum vs sesudah",
              },
              {
                style: "Curiosity",
                hookText: "Cuma butuh 5 menit tiap tanggal 25 buat mengunci 3 pos gaji ini.",
                visualCue: "Tunjuk 3 baris tabel warna kontras",
              },
              {
                style: "Problem-First",
                hookText: "Kenapa gaji selalu terasa numpang lewat padahal tidak beli barang mewah?",
                visualCue: "Close-up catatan pengeluaran harian",
              },
            ],
            bodyContent:
              "[0-3s] Baru tanggal 18 tapi gaji sudah menipis? Urutan alokasinya yang perlu dibalik.\n[4-20s] Begitu gaji masuk, langsung pisahkan ke tiga pos: pertama kebutuhan wajib kos dan ongkos, kedua pos dana darurat bertahap, baru ketiga pos jajan mingguan.\n[21-38s] Kalau dicampur di satu rekening utama, saldo terlihat besar di awal bulan sehingga bocor halus tanpa terasa.",
            closingCta:
              "Simpan video ini buat panduan pas gajian nanti, dan tulis di komentar pos mana yang paling sering bocor!",
            ctaVariants: [
              "Save video ini supaya tidak lupa pas tanggal 25.",
              "Komentar 'POS' kalau mau dibedah simulasi nominal lainnya.",
            ],
            visualAndAudioCues: [
              {
                beatLabel: "0-3s Hook",
                spokenSummary: "Masalah gaji habis tanggal 18",
                visualDirection: "Split screen wajah + tabel anggaran merah",
                onScreenTextOrAudio: "Gaji habis tgl 18? Ini sebabnya",
              },
              {
                beatLabel: "4-30s Simulasi",
                spokenSummary: "Pembagian 3 pos rekening",
                visualDirection: "Zoom ke baris spreadsheet Rp5.000.000",
                onScreenTextOrAudio: "1. Wajib | 2. Darurat | 3. Harian",
              },
            ],
            estimatedDurationSeconds: 42,
            caption:
              "Urutan alokasi di hari pertama gajian jauh lebih menentukan daripada sekadar niat berhemat di akhir bulan. Simpan simulasi 3 pos ini untuk gajian berikutnya.",
            hashtags: [
              "#keuanganpribadi",
              "#gajipertama",
              "#budgetingpemula",
              "#danadarurat",
            ],
            hashtagTiers: {
              broad: ["#keuanganpribadi"],
              niche: ["#budgetingpemula"],
              specific: ["#gajipertama", "#danadarurat"],
            },
            platformAdaptationNotes:
              "Kalimat pendek untuk ritme bicara cepat TikTok 9:16 dengan hook visual 3 detik pertama.",
          };

      return {
        rawText: JSON.stringify(payload),
        usage: {
          provider: "gemini",
          modelId: "gemini-3.8-flash",
          promptTokens: 890,
          completionTokens: 740,
          totalTokens: 1630,
          estimatedCostUsd: 0.0027,
          durationMs: 390,
        },
      };
    },
  };
}

describe("Phase 3 Integration Suite — Research, Strategy & Content Engine", () => {
  beforeEach(() => {
    resetDb();
  });

  it("satisfies all 10 Phase 3 acceptance criteria end-to-end with strict provenance, editability, platform adaptation, and credit tracking", async () => {
    const capturedRequests: StructuredTextRequest[] = [];
    const provider = buildDeterministicPhase3Provider(capturedRequests);

    // 1. Save Competitor Evidence first (`competitor_profiles`)
    const savedCompetitor = await ResearchService.saveCompetitorProfile(WS_A, USER_A, {
      handle: "@uangrapi.id",
      displayName: "Uang Rapi Indonesia",
      platform: "tiktok",
      profileUrl: "https://www.tiktok.com/@uangrapi.id",
      followerCountEstimate: 45000,
      positioningSummary: "Infografis keuangan dasar pekerja perkotaan",
      observedHooks: [
        {
          hookText: "3 kesalahan mengatur gaji di usia 23 tahun",
          formatNote: "Carousel 5 slide",
          sourcePostUrl: "https://www.tiktok.com/@uangrapi.id/video/7300000000000000001",
        },
      ],
      topPerformingTopics: ["Dana darurat", "Catat pengeluaran"],
      contentGaps: ["Belum ada simulasi spreadsheet gaji UMR daerah"],
      evidenceNotes: "Diamati dari 10 unggahan publik terakhir.",
      dataLimitations: "Hanya data tampilan publik tanpa analitik internal akun.",
    });
    expect(savedCompetitor.handle).toBe("@uangrapi.id");

    // 2. Generate Source-Backed Research Report (skipLiveNewsFetch=true tests offline disclaimer + Gemini grounding citation + competitor evidence + anti-hallucination URL stripping)
    const researchResult = await ResearchService.generateResearchReport(
      WS_A,
      USER_A,
      {
        reportType: "competitor",
        topicQuery: "Literasi gaji pertama dan celah konten kompetitor",
        targetPlatform: "tiktok",
        referenceUrls: [],
        competitorIds: [savedCompetitor.id],
      },
      {
        skipLiveNewsFetch: true,
        customProviders: { primary: provider },
      }
    );

    const report = researchResult.report;
    // Criterion 1 & 2: Research sources and retrieval timestamps are recorded
    expect(report.sources.length).toBeGreaterThanOrEqual(3); // Competitor profile URL + Competitor post URL + Grounding citation URL
    for (const src of report.sources) {
      expect(src.sourceUrl).toMatch(/^https?:\/\//);
      expect(Number.isNaN(Date.parse(src.retrievedAt))).toBe(false);
      expect(src.relevantExtract.length).toBeGreaterThan(5);
      expect(src.dataLimitations.length).toBeGreaterThan(5);
    }
    expect(Number.isNaN(Date.parse(report.retrievedAt))).toBe(false);

    // Grounded live citation succeeded -> realtimeDataAvailable is true
    expect(report.realtimeDataAvailable).toBe(true);
    expect(report.realtimeUnavailableReason).toBeNull();

    // Criterion 3 & 4: Trend claims are traceable & hallucinated URLs are stripped/downgraded!
    expect(
      report.sources.some(
        (s) => s.sourceUrl === "https://situs-halusinasi-tidak-terdaftar.example/artikel"
      )
    ).toBe(false);
    expect(report.verifiedFacts).toHaveLength(1);
    expect(report.verifiedFacts[0]?.sourceUrls).toContain(
      "https://ojk.go.id/id/berita-dan-kegiatan/literasi-keuangan-muda"
    );
    // The 2nd fact with unverified URL was demoted to aiInterpretations!
    expect(report.aiInterpretations.length).toBe(3);

    const verifiedClaim = report.trendClaims[0]!;
    expect(verifiedClaim.evidenceStatus).toBe("verified_by_sources");
    expect(verifiedClaim.supportingSourceUrls).toContain(
      "https://ojk.go.id/id/berita-dan-kegiatan/literasi-keuangan-muda"
    );
    const downgradedClaim = report.trendClaims[1]!;
    expect(downgradedClaim.evidenceStatus).toBe("qualitative_pattern_only");
    expect(downgradedClaim.supportingSourceUrls).toHaveLength(0);

    // Competitor evidence used
    expect(
      report.sources.some((s) => s.sourceOrigin === "competitor_evidence")
    ).toBe(true);
    expect(report.competitorInsights[0]?.competitorHandleOrGroup).toBe("@uangrapi.id");

    // 3. Save Brand Context & Generate Content Strategy + Edit Content Pillars (Criterion 5)
    await StrategyService.upsertBrandProfile(WS_A, USER_A, {
      brandName: "Nadia Finansial Muda",
      tagline: "Atur gaji pertama tanpa pusing",
      positioningStatement: "Edukator simulasi gaji praktis untuk fresh graduate.",
      offerSummary: "Template spreadsheet arus kas bulanan.",
      brandValues: ["Jujur", "Sederhana"],
      voiceGuidelines: ["Gunakan contoh angka konkret", "Sapa audiens secara hangat"],
    });

    const stratGen = await StrategyService.generateContentStrategy(
      WS_A,
      USER_A,
      { researchReportId: report.id, weeklyCadence: 4 },
      { primary: provider }
    );
    expect(stratGen.strategy.isActive).toBe(true);
    expect(stratGen.strategy.pillars).toHaveLength(3);
    expect(stratGen.strategy.opportunityScores.length).toBeGreaterThanOrEqual(3);

    // Edit an existing Content Pillar
    const firstPillar = stratGen.strategy.pillars[0]!;
    const editedPillar = await StrategyService.upsertContentPillar(WS_A, USER_A, {
      id: firstPillar.id,
      strategyId: stratGen.strategy.id,
      name: "Simulasi Gaji UMR & Freshgrad (Edited)",
      description: "Bedah alokasi gaji bulanan dengan studi kasus kota besar & daerah.",
      objective: "educate",
      ratioPercentage: 50,
      exampleTopics: ["Simulasi gaji Rp4,5 juta", "Pos gajian anti bocor"],
      recommendedFormats: ["TikTok 45 detik", "LinkedIn Carousel"],
      colorCode: "#2563EB",
      sortOrder: 0,
    });
    expect(editedPillar.name).toBe("Simulasi Gaji UMR & Freshgrad (Edited)");
    expect(editedPillar.ratioPercentage).toBe(50);

    // Verify CreatorContextService now includes Brand Context + Active Strategy with edited pillar
    const enrichedContext = await CreatorContextService.getWorkspaceCreatorContext(
      WS_A,
      USER_A
    );
    expect(enrichedContext.brandContext?.brandName).toBe("Nadia Finansial Muda");
    expect(enrichedContext.activeStrategy?.pillars[0]?.name).toBe(
      "Simulasi Gaji UMR & Freshgrad (Edited)"
    );

    // 4. Generate & Save Content Ideas + Edit Idea (Criterion 6)
    const ideaGen = await ContentEngineService.generateIdeas(
      WS_A,
      USER_A,
      {
        targetPlatform: "tiktok",
        count: 4,
        pillarId: editedPillar.id,
        researchReportId: report.id,
      },
      { primary: provider }
    );
    expect(ideaGen.ideas).toHaveLength(4);
    const targetIdea = ideaGen.ideas[0]!;
    const updatedIdea = await ContentEngineService.saveIdea(WS_A, USER_A, {
      id: targetIdea.id,
      pillarId: editedPillar.id,
      researchReportId: report.id,
      title: `${targetIdea.title} — Studi Kasus Nyata`,
      hookConcept: targetIdea.hookConcept,
      angleType: targetIdea.angleType,
      targetPlatform: "tiktok",
      opportunityScore: 91,
      opportunityRationale: targetIdea.opportunityRationale,
      researchTrace: targetIdea.researchTrace,
      status: "shortlisted",
    });
    expect(updatedIdea.status).toBe("shortlisted");
    expect(updatedIdea.title).toContain("Studi Kasus Nyata");

    // 5. Generate Platform-Specific Content Package + Edit Script & Version History (Criterion 7)
    const pkgGen = await ContentEngineService.generateContentPackage(
      WS_A,
      USER_A,
      {
        topicOrBrief: updatedIdea.title,
        targetPlatform: "tiktok",
        framework: "PAS",
        targetDurationSeconds: 45,
        pillarId: editedPillar.id,
        ideaId: updatedIdea.id,
        researchReportId: report.id,
      },
      { primary: provider }
    );

    const tiktokPkg = pkgGen.contentPackage;
    expect(tiktokPkg.primaryPlatform).toBe("tiktok");
    expect(tiktokPkg.hookVariants.length).toBeGreaterThanOrEqual(3);
    expect(tiktokPkg.currentScript?.version).toBe(1);
    expect(tiktokPkg.hashtags.every((t) => t.startsWith("#"))).toBe(true);

    // Confirm prompt injected Creator DNA, Brand Context, Selected Niche, Audience Persona, Platform Rules & Research
    const scriptGenPrompt =
      capturedRequests.find((r) => r.schemaName === "content_package_output")?.userPrompt ?? "";
    expect(scriptGenPrompt).toContain("Nadia Finansial Muda");
    expect(scriptGenPrompt).toContain("Raka Freshgrad");
    expect(scriptGenPrompt).toContain("Budgeting Gaji Pertama");
    expect(scriptGenPrompt).toContain("ATURAN SPESIFIK PLATFORM TARGET: TIKTOK");
    expect(scriptGenPrompt).toContain("Dossier Riset Literasi Gaji Pertama");

    // Edit the saved Script & save as New Version (v2)
    const editedPkgV2 = await ContentEngineService.saveEditableContentPackage(WS_A, USER_A, {
      contentItemId: tiktokPkg.id,
      scriptId: tiktokPkg.currentScript!.id,
      saveAsNewScriptVersion: true,
      pillarId: editedPillar.id,
      ideaId: updatedIdea.id,
      researchReportId: report.id,
      title: "Simulasi 3 Rekening Gaji Pertama (Revisi Final)",
      primaryPlatform: "tiktok",
      contentFormat: tiktokPkg.contentFormat,
      stage: "ready_for_production",
      framework: "PAS",
      openingHook: "Tanggal 18 saldo tinggal ongkos? Balik urutan alokasi gajimu sekarang!",
      hookVariants: tiktokPkg.hookVariants,
      bodyContent: `${tiktokPkg.currentScript!.bodyContent}\n[Tambahan Editor: Tampilkan ringkasan angka di akhir video.]`,
      closingCta: "Simpan panduan ini untuk tanggal 25 nanti!",
      ctaVariants: tiktokPkg.ctaVariants,
      visualAndAudioCues: tiktokPkg.currentScript!.visualAndAudioCues,
      estimatedDurationSeconds: 45,
      caption: tiktokPkg.caption,
      hashtags: ["#gajipertama", "budgetingmudah"],
      platformAdaptationNotes: tiktokPkg.platformAdaptationNotes,
    });
    expect(editedPkgV2.title).toBe("Simulasi 3 Rekening Gaji Pertama (Revisi Final)");
    expect(editedPkgV2.stage).toBe("ready_for_production");
    expect(editedPkgV2.currentScript?.version).toBe(2);
    expect(editedPkgV2.versionCount).toBe(2);
    expect(editedPkgV2.hashtags).toContain("#budgetingmudah");

    // 6. Cross-Platform Adaptation: TikTok -> LinkedIn (Criterion 8)
    const adaptedGen = await ContentEngineService.adaptContentToPlatform(
      WS_A,
      USER_A,
      {
        sourceContentItemId: editedPkgV2.id,
        targetPlatform: "linkedin",
        targetFramework: "AIDA",
      },
      { primary: provider }
    );
    const linkedinPkg = adaptedGen.contentPackage;
    expect(linkedinPkg.primaryPlatform).toBe("linkedin");
    expect(linkedinPkg.sourceContentItemId).toBe(editedPkgV2.id);
    expect(linkedinPkg.currentScript?.framework).toBe("AIDA");
    expect(linkedinPkg.platformAdaptationNotes).toContain("LinkedIn");

    // 7. AI Usage & Credit Ledger Verification (Criterion 9)
    // Operations run: competitor_research (2) + content_strategy (3) + content_idea (2) + content_package (3) + platform_adaptation (2) = 12 credits
    const walletAfter = db.wallets.get(WS_A)!;
    expect(walletAfter.balance).toBe(50 - 12);
    expect(db.tables.ai_provider_usage).toHaveLength(5);
    expect(
      db.tables.ai_provider_usage.map((u) => u.operation_type)
    ).toEqual([
      "competitor_research_generation",
      "content_strategy_generation",
      "content_idea_generation",
      "content_package_generation",
      "platform_content_adaptation",
    ]);

    // 8. Cross-Tenant Isolation Check: USER_B cannot access WS_A resources
    db.activeUserId = USER_B;
    await expect(
      ResearchService.listResearchReports(WS_A, USER_B)
    ).rejects.toThrow();
    await expect(
      StrategyService.listStrategiesWithPillars(WS_A, USER_B)
    ).rejects.toThrow();
    await expect(
      ContentEngineService.listContentPackages(WS_A, USER_B)
    ).rejects.toThrow();
  });

  it("records a clear realtimeUnavailableReason when live web grounding and RSS news are unavailable", async () => {
    const captured: StructuredTextRequest[] = [];
    const baseProvider = buildDeterministicPhase3Provider(captured);
    const nonGroundedProvider: TextGenerationProvider = {
      name: "openai",
      isConfigured: () => true,
      generateStructuredJson: async (req) => {
        const res = await baseProvider.generateStructuredJson(req);
        return {
          ...res,
          groundingCitations: [],
          searchQueries: [],
        };
      },
    };

    const offlineDossier = await ResearchService.generateResearchReport(
      WS_A,
      USER_A,
      {
        reportType: "audience",
        topicQuery: "Kebutuhan audiens pengelolaan dana darurat",
        targetPlatform: "instagram",
        referenceUrls: [],
        competitorIds: [],
      },
      {
        skipLiveNewsFetch: true,
        customProviders: { primary: nonGroundedProvider },
      }
    );

    expect(offlineDossier.report.realtimeDataAvailable).toBe(false);
    expect(offlineDossier.report.realtimeUnavailableReason).toBeTruthy();
    expect(
      (offlineDossier.report.realtimeUnavailableReason ?? "").length
    ).toBeGreaterThan(20);
    // Because no external URLs were grounded, any AI-claimed verifiedFacts were safely demoted to aiInterpretations
    expect(offlineDossier.report.verifiedFacts).toHaveLength(0);
    expect(offlineDossier.report.aiInterpretations.length).toBeGreaterThanOrEqual(2);
  });
});
