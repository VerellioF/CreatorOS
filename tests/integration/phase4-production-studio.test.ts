import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { ProductionStudioService } from "@/services/production-studio-service";
import { InsufficientCreditsError } from "@/lib/ai/types";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const USER_VIEWER = "33333333-3333-4333-8333-333333333333";
const WS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Row = Record<string, unknown>;

interface Phase4MockDb {
  activeUserId: string;
  tables: {
    storyboards: Row[];
    media_assets: Row[];
    generation_jobs: Row[];
    video_projects: Row[];
    ai_provider_usage: Row[];
    credit_wallets: Row[];
    credit_transactions: Row[];
    workspace_members: Row[];
    workspaces: Row[];
  };
  wallets: Map<
    string,
    { id: string; workspace_id: string; balance: number; monthly_allowance: number }
  >;
  members: Array<{ workspace_id: string; user_id: string; role: string }>;
}

let db: Phase4MockDb;

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
  db = {
    activeUserId: USER_A,
    members: [
      { workspace_id: WS_A, user_id: USER_A, role: "owner" },
      { workspace_id: WS_B, user_id: USER_B, role: "owner" },
      { workspace_id: WS_A, user_id: USER_VIEWER, role: "viewer" },
    ],
    wallets: new Map([
      [WS_A, { id: "wal-a", workspace_id: WS_A, balance: 50, monthly_allowance: 50 }],
      [WS_B, { id: "wal-b", workspace_id: WS_B, balance: 50, monthly_allowance: 50 }],
    ]),
    tables: {
      storyboards: [],
      media_assets: [],
      generation_jobs: [],
      video_projects: [],
      ai_provider_usage: [],
      credit_wallets: [],
      credit_transactions: [],
      workspace_members: [
        { workspace_id: WS_A, user_id: USER_A, role: "owner" },
        { workspace_id: WS_B, user_id: USER_B, role: "owner" },
        { workspace_id: WS_A, user_id: USER_VIEWER, role: "viewer" },
      ],
      workspaces: [
        { id: WS_A, name: "Workspace A", deleted_at: null },
        { id: WS_B, name: "Workspace B", deleted_at: null },
      ],
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    return {
      rpc: vi.fn(async (fnName: string, args: Record<string, unknown>) => {
        if (fnName === "record_ai_usage_and_deduct_credits") {
          const wsId = String(args.target_workspace_id);
          const wallet = db.wallets.get(wsId);
          if (!wallet) return { data: null, error: { message: "Wallet not found" } };

          const charge = Number(args.p_credits_to_deduct) || 0;
          if (charge > 0 && wallet.balance < charge) {
            return { data: null, error: { message: "insufficient workspace credits" } };
          }
          wallet.balance -= charge;

          const usageId = randomUUID();
          db.tables.ai_provider_usage.push({
            id: usageId,
            workspace_id: wsId,
            operation_type: args.p_operation_type,
            provider: args.p_provider,
            credits_charged: charge,
          });

          return {
            data: {
              usage_id: usageId,
              agent_run_id: randomUUID(),
              credits_deducted: charge,
              remaining_balance: wallet.balance,
            },
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
            order: () => chain,
            limit: () => chain,
            single: async () => {
              const rows = applyFilters();
              if (rows.length === 0) {
                return { data: null, error: { message: "Row not found" } };
              }
              return { data: rows[0], error: null };
            },
            maybeSingle: async () => {
              const rows = applyFilters();
              return { data: rows[0] ?? null, error: null };
            },
            then: (resolve: (v: unknown) => unknown) => {
              const rows = applyFilters();
              return Promise.resolve(resolve({ data: rows, error: null }));
            },
          };
          return chain;
        };

        const applyFilters = () => {
          const rawTable = (db.tables as Record<string, Row[]>)[table] ?? [];
          return rawTable.filter((r) => {
            for (const [k, v] of Object.entries(filters)) {
              if (r[k] !== v) return false;
            }
            return true;
          });
        };

        return {
          select: () => makeSelectChain(),
          insert: (values: Row | Row[]) => {
            const arr = Array.isArray(values) ? values : [values];
            const insertedRows = arr.map((row) => ({
              id: row.id || randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ...row,
            }));
            const rawTable = (db.tables as Record<string, Row[]>)[table] ?? [];
            rawTable.push(...insertedRows);

            return {
              select: () => ({
                single: async () => ({ data: insertedRows[0], error: null }),
              }),
            };
          },
          update: (updates: Row) => ({
            eq: (col: string, val: unknown) => {
              filters[col] = val;
              return {
                eq: (c2: string, v2: unknown) => {
                  filters[c2] = v2;
                  return {
                    select: () => ({
                      single: async () => {
                        const rawTable = (db.tables as Record<string, Row[]>)[table] ?? [];
                        for (const row of rawTable) {
                          if (row[col] === val && row[c2] === v2) {
                            Object.assign(row, updates);
                            return { data: row, error: null };
                          }
                        }
                        return { data: null, error: { message: "Not found for update" } };
                      },
                    }),
                    then: (resolve: (v: unknown) => unknown) => {
                      const rawTable = (db.tables as Record<string, Row[]>)[table] ?? [];
                      for (const row of rawTable) {
                        if (row[col] === val && row[c2] === v2) {
                          Object.assign(row, updates);
                        }
                      }
                      return Promise.resolve(resolve({ error: null }));
                    },
                  };
                },
                select: () => ({
                  single: async () => {
                    const rawTable = (db.tables as Record<string, Row[]>)[table] ?? [];
                    for (const row of rawTable) {
                      if (row[col] === val) {
                        Object.assign(row, updates);
                        return { data: row, error: null };
                      }
                    }
                    return { data: null, error: { message: "Not found for update" } };
                  },
                }),
                then: (resolve: (v: unknown) => unknown) => {
                  const rawTable = (db.tables as Record<string, Row[]>)[table] ?? [];
                  for (const row of rawTable) {
                    if (row[col] === val) {
                      Object.assign(row, updates);
                    }
                  }
                  return Promise.resolve(resolve({ error: null }));
                },
              };
            },
          }),
        };
      }),
    };
  }),
}));

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn(
      async (userId: string, workspaceId: string, role = "viewer") => {
        return hasRole(workspaceId, userId, role);
      }
    ),
  },
}));

vi.mock("@/services/usage-billing-service", () => ({
  UsageBillingService: {
    getWorkspaceCreditBalance: vi.fn(async (workspaceId: string, userId: string) => {
      if (!hasRole(workspaceId, userId, "viewer")) {
        throw new Error("Akses ditolak");
      }
      const w = db.wallets.get(workspaceId);
      return { balance: w?.balance ?? 50, monthlyAllowance: 50 };
    }),
    assertSufficientCredits: vi.fn(
      async (workspaceId: string, userId: string, required: number) => {
        if (!hasRole(workspaceId, userId, "editor")) {
          throw new Error("Akses Editor diperlukan.");
        }
        const w = db.wallets.get(workspaceId);
        const bal = w?.balance ?? 0;
        if (required > 0 && bal < required) {
          throw new InsufficientCreditsError(required, bal);
        }
        return bal;
      }
    ),
    recordExecutionUsage: vi.fn(async (params: { workspaceId: string; creditsToDeduct: number }) => {
      const w = db.wallets.get(params.workspaceId);
      if (w) w.balance -= params.creditsToDeduct;
      return {
        agentRunId: randomUUID(),
        usageId: randomUUID(),
        creditsDeducted: params.creditsToDeduct,
        remainingBalance: w?.balance ?? 0,
      };
    }),
  },
}));

describe("Phase 4 Integration Tests — Production Studio, Multi-Tenancy & Asset Lifecycle", () => {
  beforeEach(() => {
    resetDb();
  });

  it("enforces multi-tenant isolation across storyboards between Workspace A and Workspace B", async () => {
    // User A creates a storyboard in Workspace A
    const sbId = await ProductionStudioService.saveStoryboard(WS_A, USER_A, {
      title: "Storyboard Rahasia Workspace A",
      visualTheme: "cinematic",
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 5,
          shotType: "close_up",
          shotDescription: "Close-up wajah kreator",
          visualDirection: "Push in",
          voiceoverText: "Halo semuanya!",
          subtitleText: "Halo semuanya!",
          transitionSuggestion: "cut",
        },
      ],
    });

    expect(sbId).toBeDefined();

    // User A can list storyboards in Workspace A
    const listA = await ProductionStudioService.listStoryboards(WS_A, USER_A);
    expect(listA.length).toBe(1);
    expect(listA[0].id).toBe(sbId);

    // User B cannot list storyboards in Workspace A
    await expect(ProductionStudioService.listStoryboards(WS_A, USER_B)).rejects.toThrow(
      /akses ditolak/i
    );

    // User B listing in Workspace B sees 0 storyboards
    const listB = await ProductionStudioService.listStoryboards(WS_B, USER_B);
    expect(listB.length).toBe(0);
  });

  it("enforces RBAC: Viewer cannot save storyboards or trigger AI generation", async () => {
    // Viewer in Workspace A attempts to save storyboard
    await expect(
      ProductionStudioService.saveStoryboard(WS_A, USER_VIEWER, {
        title: "Unauthorized Storyboard",
        visualTheme: "Modern Dark",
        scenes: [
          {
            sceneNumber: 1,
            durationSeconds: 5,
            shotType: "medium",
            shotDescription: "Adegan",
            visualDirection: "Static",
            voiceoverText: "",
            subtitleText: "",
            transitionSuggestion: "cut",
          },
        ],
      })
    ).rejects.toThrow(/peran editor, admin, atau owner diperlukan/i);

    // Viewer in Workspace A attempts to generate an image
    await expect(
      ProductionStudioService.generateImage(WS_A, USER_VIEWER, {
        mode: "thumbnail",
        prompt: "Sebuah thumbnail",
        aspectRatio: "9:16",
        style: "cinematic",
      })
    ).rejects.toThrow(/akses editor diperlukan/i);
  });

  it("generates real image assets and accurately deducts 2 credits", async () => {
    const initialBal = db.wallets.get(WS_A)!.balance;

    const asset = await ProductionStudioService.generateImage(WS_A, USER_A, {
      mode: "thumbnail",
      prompt: "Thumbnail Kreator Sukses",
      aspectRatio: "9:16",
      style: "vibrant_creator",
    });

    expect(asset).toBeDefined();
    expect(asset.asset_type).toBe("thumbnail");
    expect(asset.public_url).toMatch(/^\/api\/media\//);
    expect(asset.file_size_bytes).toBeGreaterThan(0);

    // Check credit deduction (2 credits for image)
    const newBal = db.wallets.get(WS_A)!.balance;
    expect(newBal).toBe(initialBal - 2);
  });

  it("generates real playable voiceover audio files and deducts 2 credits", async () => {
    const initialBal = db.wallets.get(WS_A)!.balance;

    const asset = await ProductionStudioService.generateVoiceover(WS_A, USER_A, {
      text: "Selamat datang di CreatorOS AI, studio produksi konten Anda.",
      language: "id",
      personaId: "budi_energetic",
      speed: 1.0,
      pitch: 1.0,
    });

    expect(asset).toBeDefined();
    expect(asset.asset_type).toBe("voiceover");
    expect(asset.mime_type).toBe("audio/wav");
    expect(asset.duration_seconds).toBeGreaterThan(1);
    expect(asset.public_url).toMatch(/^\/api\/media\//);

    const newBal = db.wallets.get(WS_A)!.balance;
    expect(newBal).toBe(initialBal - 2);
  });

  it("manages video generation job lifecycle, status progress, and retry handling", async () => {
    const initialBal = db.wallets.get(WS_A)!.balance;

    const { job, asset } = await ProductionStudioService.queueVideoGeneration(WS_A, USER_A, {
      mode: "text_to_video",
      prompt: "Cinematic studio scene dengan pencahayaan neon",
      aspectRatio: "9:16",
      durationSeconds: 5,
      motion: "cinematic_slow_pan",
    });

    expect(job).toBeDefined();
    expect(job.status).toBe("completed");
    expect(job.progress_percent).toBe(100);
    expect(asset.asset_type).toBe("video_clip");
    expect(asset.mime_type).toBe("video/mp4");
    expect(asset.duration_seconds).toBe(5);

    // 5 credits deducted for video generation
    expect(db.wallets.get(WS_A)!.balance).toBe(initialBal - 5);

    // Test retry on a failed job simulation
    const failedJobRow: Row = {
      id: randomUUID(),
      workspace_id: WS_A,
      job_type: "video_generation",
      status: "failed",
      progress_percent: 40,
      error_message: "Network timeout with video provider",
      attempts: 1,
      max_attempts: 3,
      input_payload: { prompt: "Failed job prompt" },
      created_by: USER_A,
    };
    db.tables.generation_jobs.push(failedJobRow);

    const retriedJob = await ProductionStudioService.retryGenerationJob(
      WS_A,
      USER_A,
      String(failedJobRow.id)
    );
    expect(retriedJob.status).toBe("queued");
    expect(retriedJob.attempts).toBe(2);
    expect(retriedJob.error_message).toBeNull();
  });

  it("blocks AI operations when workspace credits are exhausted", async () => {
    // Drain credits to 0
    db.wallets.get(WS_A)!.balance = 0;

    await expect(
      ProductionStudioService.generateImage(WS_A, USER_A, {
        mode: "thumbnail",
        prompt: "Gambar tanpa kredit",
        aspectRatio: "9:16",
        style: "cinematic",
      })
    ).rejects.toThrow(InsufficientCreditsError);
  });

  it("saves and retrieves timeline video projects and dispatches export", async () => {
    const projectId = await ProductionStudioService.saveVideoProject(WS_A, USER_A, {
      title: "Proyek Timeline Reels",
      timelineData: {
        tracks: [
          {
            id: "track-1",
            type: "video",
            name: "Visuals",
            muted: false,
            locked: false,
            clips: [
              {
                id: "c-1",
                trackId: "track-1",
                title: "Opening",
                assetType: "image",
                startTime: 0,
                endTime: 5,
                trimStart: 0,
                trimEnd: 5,
                volume: 1,
              },
            ],
          },
        ],
        duration: 5,
      },
      aspectRatio: "9:16",
      resolution: "1080p",
      fps: 30,
    });

    expect(projectId).toBeDefined();

    const loaded = await ProductionStudioService.getVideoProject(WS_A, USER_A, projectId);
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe("Proyek Timeline Reels");

    // Queue export
    const exportJob = await ProductionStudioService.queueVideoExport(WS_A, USER_A, {
      projectId,
      title: "Export Final Reels",
      aspectRatio: "9:16",
      resolution: "1080p",
      fps: 30,
      timelineData: {
        tracks: [],
        duration: 5,
      },
    });

    expect(exportJob).toBeDefined();
    expect(exportJob.job_type).toBe("timeline_export");
  });
});
