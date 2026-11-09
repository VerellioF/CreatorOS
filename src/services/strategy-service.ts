import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { ResearchService } from "@/services/research-service";
import { formatCreatorContextPromptBlock } from "@/lib/ai/context-builder";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import { CONTENT_STRATEGY_JSON_SCHEMA } from "@/lib/ai/schemas/research-and-strategy-json-schemas";
import type { TextGenerationProvider } from "@/lib/ai/types";
import {
  aiContentStrategyOutputSchema,
  brandProfileInputSchema,
  contentPillarEditableSchema,
  opportunityScoreItemSchema,
  platformDistributionItemSchema,
  updateStrategyOverviewSchema,
  type BrandProfileInput,
  type ContentPillarEditableInput,
  type OpportunityScoreItem,
  type PlatformDistributionItem,
  type UpdateStrategyOverviewInput,
} from "@/lib/validation/strategy-and-content-schemas";
import type {
  BrandProfileRow,
  ContentPillarRow,
  ContentStrategyRow,
  Json,
  PillarObjective,
} from "@/lib/supabase/types";

export interface HydratedContentPillar {
  id: string;
  strategyId: string;
  workspaceId: string;
  name: string;
  description: string;
  objective: PillarObjective;
  ratioPercentage: number;
  exampleTopics: string[];
  recommendedFormats: string[];
  colorCode: string;
  sortOrder: number;
}

export interface HydratedContentStrategy {
  id: string;
  workspaceId: string;
  researchReportId: string | null;
  title: string;
  positioningStatement: string;
  uniqueDifferentiator: string;
  coreNarrative: string;
  publishingFrequencyPerWeek: number;
  isActive: boolean;
  platformDistribution: PlatformDistributionItem[];
  opportunityScores: OpportunityScoreItem[];
  pillars: HydratedContentPillar[];
  updatedAt: string;
}

function parseJsonArray<T>(
  raw: unknown,
  parser: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }
): T[] {
  if (!Array.isArray(raw)) return [];
  const items: T[] = [];
  for (const item of raw) {
    const parsed = parser.safeParse(item);
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

function mapPillarRow(row: ContentPillarRow): HydratedContentPillar {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    objective: row.objective,
    ratioPercentage: row.ratio_percentage,
    exampleTopics: row.example_topics ?? [],
    recommendedFormats: row.recommended_formats ?? [],
    colorCode: row.color_code,
    sortOrder: row.sort_order,
  };
}

function mapStrategyRow(
  row: ContentStrategyRow,
  pillarRows: ContentPillarRow[]
): HydratedContentStrategy {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    researchReportId: row.research_report_id,
    title: row.title,
    positioningStatement: row.positioning_statement,
    uniqueDifferentiator: row.unique_differentiator,
    coreNarrative: row.core_narrative,
    publishingFrequencyPerWeek: row.publishing_frequency_per_week,
    isActive: row.is_active,
    platformDistribution: parseJsonArray(
      row.platform_distribution,
      platformDistributionItemSchema
    ),
    opportunityScores: parseJsonArray(row.opportunity_scores, opportunityScoreItemSchema),
    pillars: pillarRows.map(mapPillarRow),
    updatedAt: row.updated_at,
  };
}

export class StrategyService {
  static async getBrandProfile(
    workspaceId: string,
    userId: string
  ): Promise<BrandProfileInput | null> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!allowed) throw new Error("Akses ditolak ke profil brand workspace.");

    const supabase = await createClient();
    const { data } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const row = data as BrandProfileRow | null;
    if (!row) return null;
    return {
      brandName: row.brand_name,
      tagline: row.tagline ?? "",
      positioningStatement: row.positioning_statement ?? "",
      offerSummary: row.offer_summary ?? "",
      brandValues: row.brand_values ?? [],
      voiceGuidelines: row.voice_guidelines ?? [],
    };
  }

  static async upsertBrandProfile(
    workspaceId: string,
    userId: string,
    rawInput: BrandProfileInput
  ): Promise<BrandProfileInput> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error("Akses Editor diperlukan untuk mengubah Brand Context.");

    const input = brandProfileInputSchema.parse(rawInput);
    const supabase = await createClient();

    const { error } = await supabase.from("brand_profiles").upsert(
      {
        workspace_id: workspaceId,
        brand_name: input.brandName,
        tagline: input.tagline,
        positioning_statement: input.positioningStatement,
        offer_summary: input.offerSummary,
        brand_values: input.brandValues,
        voice_guidelines: input.voiceGuidelines,
        created_by: userId,
      },
      { onConflict: "workspace_id" }
    );

    if (error) throw new Error(`Gagal menyimpan Brand Context: ${error.message}`);
    return input;
  }

  static async listStrategiesWithPillars(
    workspaceId: string,
    userId: string
  ): Promise<HydratedContentStrategy[]> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!allowed) throw new Error("Akses ditolak ke strategi konten workspace.");

    const supabase = await createClient();
    const [{ data: strategyRowsData }, { data: pillarRowsData }] = await Promise.all([
      supabase
        .from("content_strategies")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("content_pillars")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("sort_order", { ascending: true }),
    ]);

    const strategies = (strategyRowsData ?? []) as ContentStrategyRow[];
    const pillars = (pillarRowsData ?? []) as ContentPillarRow[];
    const byStrategy = new Map<string, ContentPillarRow[]>();
    for (const p of pillars) {
      const arr = byStrategy.get(p.strategy_id) ?? [];
      arr.push(p);
      byStrategy.set(p.strategy_id, arr);
    }

    return strategies.map((s) => mapStrategyRow(s, byStrategy.get(s.id) ?? []));
  }

  static async generateContentStrategy(
    workspaceId: string,
    userId: string,
    params: {
      researchReportId?: string | null;
      customFocusNotes?: string;
      weeklyCadence?: number;
    },
    customProviders?: {
      primary?: TextGenerationProvider;
      fallback?: TextGenerationProvider;
    }
  ): Promise<{
    strategy: HydratedContentStrategy;
    remainingCredits: number;
    totalTokens: number;
  }> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error("Akses Editor diperlukan untuk menyusun strategi konten.");

    const context = await CreatorContextService.getWorkspaceCreatorContext(
      workspaceId,
      userId
    );
    const reports = await ResearchService.listResearchReports(workspaceId, userId);
    const chosenReport = params.researchReportId
      ? reports.find((r) => r.id === params.researchReportId)
      : reports[0];

    const researchBlock = chosenReport
      ? [
          `--- TEMUAN RISET RUJUKAN (${chosenReport.title}) ---`,
          `Ringkasan: ${chosenReport.summary}`,
          `Fakta Terverifikasi: ${
            chosenReport.verifiedFacts.map((f) => f.fact).join("; ") ||
            "Analisis kualitatif"
          }`,
          `Klaim Tren: ${chosenReport.trendClaims.map((t) => t.claim).join("; ")}`,
          `Rekomendasi Riset: ${chosenReport.actionableRecommendations.join("; ")}`,
        ].join("\n")
      : "Belum ada laporan riset spesifik; dasarkan strategi pada Creator DNA, Brand Context, dan Persona Audiens.";

    const systemPrompt = [
      "Anda adalah Strategist Agent di CreatorOS AI.",
      "TUGAS: Merancang Content Positioning, Strategi Distribusi Multi-Platform, Opportunity Scoring terukur, dan 3-5 Pilar Konten yang seimbang (total proporsi mendekati 100%).",
      "ATURAN: Jangan menjanjikan viralitas atau penghasilan pasti. Gunakan rasional berbasis kecocokan kreator, kebutuhan audiens, dan bukti riset.",
    ].join("\n");

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      researchBlock,
      `Target Frekuensi Publikasi Mingguan: ${params.weeklyCadence ?? 4} konten/minggu`,
      params.customFocusNotes ? `Catatan Fokus Tambahan: ${params.customFocusNotes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const aiGen = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "StrategistAgent",
      operationType: "content_strategy_generation",
      preferredModel: context.defaultAiModel,
      systemPrompt,
      userPrompt,
      schemaName: "content_strategy_blueprint",
      jsonSchema: CONTENT_STRATEGY_JSON_SCHEMA,
      zodSchema: aiContentStrategyOutputSchema,
      maxOutputTokens: 4200,
      inputSummary: {
        researchReportId: chosenReport?.id ?? null,
        weeklyCadence: params.weeklyCadence ?? 4,
      },
      customProviders,
    });

    const supabase = await createClient();

    // Insert with is_active = false first, then atomically activate via RPC
    const { data: insertedStrategy, error: stratErr } = await supabase
      .from("content_strategies")
      .insert({
        workspace_id: workspaceId,
        research_report_id: chosenReport?.id ?? null,
        title: aiGen.data.title,
        positioning_statement: aiGen.data.positioningStatement,
        unique_differentiator: aiGen.data.uniqueDifferentiator,
        core_narrative: aiGen.data.coreNarrative,
        publishing_frequency_per_week: aiGen.data.publishingFrequencyPerWeek,
        platform_distribution: aiGen.data.platformDistribution as unknown as Json,
        opportunity_scores: aiGen.data.opportunityScores as unknown as Json,
        is_active: false,
        created_by: userId,
      })
      .select("*")
      .single();

    if (stratErr || !insertedStrategy) {
      throw new Error(stratErr?.message || "Gagal menyimpan strategi konten.");
    }

    const stratRow = insertedStrategy as ContentStrategyRow;

    const pillarPayloads = aiGen.data.pillars.map((p, idx) => ({
      strategy_id: stratRow.id,
      workspace_id: workspaceId,
      name: p.name,
      description: p.description,
      objective: p.objective,
      ratio_percentage: p.ratioPercentage,
      example_topics: p.exampleTopics,
      recommended_formats: p.recommendedFormats,
      color_code: p.colorCode,
      sort_order: idx,
    }));

    const { data: insertedPillars, error: pilErr } = await supabase
      .from("content_pillars")
      .insert(pillarPayloads)
      .select("*");

    if (pilErr) {
      throw new Error(`Gagal menyimpan pilar konten: ${pilErr.message}`);
    }

    const { error: actErr } = await supabase.rpc("activate_content_strategy", {
      target_workspace_id: workspaceId,
      target_strategy_id: stratRow.id,
    });
    if (actErr) {
      throw new Error(`Gagal mengaktifkan strategi konten: ${actErr.message}`);
    }

    return {
      strategy: mapStrategyRow(
        { ...stratRow, is_active: true },
        (insertedPillars ?? []) as ContentPillarRow[]
      ),
      remainingCredits: aiGen.billing.remainingBalance,
      totalTokens: aiGen.usage.totalTokens,
    };
  }

  static async createManualStrategyIfMissing(
    workspaceId: string,
    userId: string,
    title = "Strategi Konten Utama"
  ): Promise<HydratedContentStrategy> {
    const existing = await this.listStrategiesWithPillars(workspaceId, userId);
    const active = existing.find((s) => s.isActive) ?? existing[0];
    if (active) return active;

    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error("Akses Editor diperlukan.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_strategies")
      .insert({
        workspace_id: workspaceId,
        title,
        positioning_statement:
          "Menyajikan konten praktis dan terpercaya yang relevan bagi target audiens utama.",
        unique_differentiator: "Fokus pada solusi nyata yang langsung dapat diterapkan.",
        core_narrative: "Konsistensi edukasi dan bukti nyata.",
        publishing_frequency_per_week: 4,
        is_active: false,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message || "Gagal membuat kerangka strategi.");
    const row = data as ContentStrategyRow;
    await supabase.rpc("activate_content_strategy", {
      target_workspace_id: workspaceId,
      target_strategy_id: row.id,
    });
    return mapStrategyRow({ ...row, is_active: true }, []);
  }

  static async updateStrategyOverview(
    workspaceId: string,
    userId: string,
    rawInput: UpdateStrategyOverviewInput
  ): Promise<void> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error("Akses Editor diperlukan untuk mengedit strategi.");

    const input = updateStrategyOverviewSchema.parse(rawInput);
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_strategies")
      .update({
        title: input.title,
        positioning_statement: input.positioningStatement,
        unique_differentiator: input.uniqueDifferentiator,
        core_narrative: input.coreNarrative,
        publishing_frequency_per_week: input.publishingFrequencyPerWeek,
      })
      .eq("id", input.strategyId)
      .eq("workspace_id", workspaceId);

    if (error) throw new Error(`Gagal memperbarui strategi: ${error.message}`);
  }

  static async upsertContentPillar(
    workspaceId: string,
    userId: string,
    rawInput: ContentPillarEditableInput
  ): Promise<HydratedContentPillar> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error("Akses Editor diperlukan untuk mengubah pilar konten.");

    const input = contentPillarEditableSchema.parse(rawInput);
    const supabase = await createClient();

    const payload = {
      strategy_id: input.strategyId,
      workspace_id: workspaceId,
      name: input.name,
      description: input.description,
      objective: input.objective,
      ratio_percentage: input.ratioPercentage,
      example_topics: input.exampleTopics,
      recommended_formats: input.recommendedFormats,
      color_code: input.colorCode,
      sort_order: input.sortOrder,
    };

    if (input.id) {
      const { data, error } = await supabase
        .from("content_pillars")
        .update(payload)
        .eq("id", input.id)
        .eq("workspace_id", workspaceId)
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message || "Gagal mengedit pilar konten.");
      return mapPillarRow(data as ContentPillarRow);
    }

    const { data, error } = await supabase
      .from("content_pillars")
      .insert(payload)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Gagal menambah pilar konten.");
    return mapPillarRow(data as ContentPillarRow);
  }

  static async deleteContentPillar(
    workspaceId: string,
    userId: string,
    pillarId: string
  ): Promise<void> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error("Akses Editor diperlukan untuk menghapus pilar konten.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("content_pillars")
      .delete()
      .eq("id", pillarId)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(`Gagal menghapus pilar: ${error.message}`);
  }
}
