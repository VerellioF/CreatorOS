import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import {
  formatCreatorContextPromptBlock,
  type SelectedNicheSummary,
} from "@/lib/ai/context-builder";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import type { TextGenerationProvider } from "@/lib/ai/types";
import { NICHE_DISCOVERY_JSON_SCHEMA } from "@/lib/ai/schemas/creator-intelligence-json-schemas";
import {
  nicheDiscoveryBatchSchema,
  nicheRecommendationCandidateSchema,
} from "@/lib/validation/creator-intelligence-schemas";
import type { Json, NicheRecommendationRow } from "@/lib/supabase/types";

interface GenerateNichesOptions {
  customFocusHint?: string;
  customProviders?: {
    primary?: TextGenerationProvider;
    fallback?: TextGenerationProvider;
  };
}

function mapNicheRow(row: NicheRecommendationRow): SelectedNicheSummary | null {
  const parsed = nicheRecommendationCandidateSchema.safeParse({
    nicheTitle: row.niche_title,
    explanation: row.explanation,
    audience: row.audience,
    contentOpportunities: row.content_opportunities,
    competitionAssessment: row.competition_assessment,
    requiredSkills: row.required_skills ?? [],
    monetizationPossibilities: row.monetization_possibilities,
    confidenceLevel: row.confidence_level,
    confidenceScore: row.confidence_score,
    supportingEvidence: row.supporting_evidence,
  });

  if (!parsed.success) return null;

  return {
    id: row.id,
    isSelected: row.is_selected,
    ...parsed.data,
  };
}

export class NicheDiscoveryService {
  /**
   * Lists saved structured niche recommendations for the active workspace.
   */
  static async listRecommendations(
    workspaceId: string,
    userId: string
  ): Promise<SelectedNicheSummary[]> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!hasAccess) {
      throw new Error("Akses ditolak ke rekomendasi niche workspace ini.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("niche_recommendations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("is_selected", { ascending: false })
      .order("confidence_score", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as NicheRecommendationRow[])
      .map(mapNicheRow)
      .filter((item): item is SelectedNicheSummary => item !== null);
  }

  /**
   * Generates 3-4 structured Niche Recommendations by reusing the workspace's
   * Creator Intelligence Context (`CreatorContextService` + `formatCreatorContextPromptBlock`).
   * Strictly enforces:
   * - All 8 required fields (explanation, audience, content opportunities, competition assessment,
   *   required skills, monetization possibilities, confidence level, supporting evidence).
   * - Zero promises of guaranteed income or virality.
   * - Transparent methodology & evidence limitations per AGENTS.md Rule 3.
   */
  static async generateRecommendations(
    workspaceId: string,
    userId: string,
    options?: GenerateNichesOptions
  ): Promise<{
    recommendations: SelectedNicheSummary[];
    remainingCredits: number;
    totalTokens: number;
  }> {
    const hasEditor = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!hasEditor) {
      throw new Error(
        "Akses ditolak: peran Editor, Admin, atau Owner diperlukan untuk menghasilkan analisis niche."
      );
    }

    const context = await CreatorContextService.getWorkspaceCreatorContext(
      workspaceId,
      userId
    );

    if (!context.coreAnswers && !context.creatorDna) {
      throw new Error(
        "Lengkapi wawancara onboarding atau Creator DNA terlebih dahulu agar rekomendasi niche akurat dan terpersonalisasi."
      );
    }

    const systemPrompt = [
      "Anda adalah NicheStrategistAgent pada CreatorOS AI.",
      "Tugas Anda: menghasilkan 3 hingga 4 rekomendasi niche konten yang realistis, tajam, dan terstruktur berdasarkan konteks Creator DNA dan Onboarding kreator.",
      "Setiap rekomendasi WAJIB memuat:",
      "1. Penjelasan kecocokan (explanation) dengan minat, keahlian, waktu, peralatan, dan Creator Mode.",
      "2. Segmen audiens spesifik (audience).",
      "3. Peluang sudut konten konkret (contentOpportunities).",
      "4. Evaluasi kompetisi jujur (competitionAssessment: low/moderate/high + strategi diferensiasi + catatan metodologi kualitatif).",
      "5. Keahlian yang dibutuhkan (requiredSkills).",
      "6. Kemungkinan jalur monetisasi realistis (monetizationPossibilities) TANPA pernah menjanjikan nominal penghasilan atau jaminan viral.",
      "7. Tingkat keyakinan (confidenceLevel: high/medium/exploratory + confidenceScore 1-100).",
      "8. Bukti pendukung (supportingEvidence): rujuk sinyal nyata dari profil kreator, dan nyatakan secara transparan pada dataAvailabilityStatus bahwa statistik pasar eksternal real-time belum ditarik (analisis kualitatif berbasis profil).",
    ].join("\n");

    const focusLine = options?.customFocusHint?.trim()
      ? `\nFokus Eksplorasi Tambahan dari Pengguna: ${options.customFocusHint.trim()}`
      : "";

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      focusLine,
      "",
      "Hasilkan rekomendasi niche terstruktur dalam Bahasa Indonesia sesuai JSON Schema.",
    ].join("\n");

    const result = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "NicheStrategistAgent",
      operationType: "niche_discovery_generation",
      preferredModel: context.defaultAiModel,
      systemPrompt,
      userPrompt,
      schemaName: "NicheDiscoveryBatch",
      jsonSchema: NICHE_DISCOVERY_JSON_SCHEMA,
      zodSchema: nicheDiscoveryBatchSchema,
      maxOutputTokens: 4500,
      thinkingLevel: "medium",
      inputSummary: {
        creatorMode: context.creatorMode,
        hasCreatorDna: Boolean(context.creatorDna),
        hasCustomFocus: Boolean(options?.customFocusHint),
      },
      customProviders: options?.customProviders,
    });

    const supabase = await createClient();

    // Remove unselected older candidates while preserving any currently selected niche row
    await supabase
      .from("niche_recommendations")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("is_selected", false);

    const rowsToInsert = result.data.recommendations.map((rec) => ({
      workspace_id: workspaceId,
      niche_title: rec.nicheTitle,
      explanation: rec.explanation,
      audience: rec.audience,
      content_opportunities: rec.contentOpportunities as unknown as Json,
      competition_assessment: rec.competitionAssessment as unknown as Json,
      required_skills: rec.requiredSkills,
      monetization_possibilities: rec.monetizationPossibilities as unknown as Json,
      confidence_level: rec.confidenceLevel,
      confidence_score: rec.confidenceScore,
      supporting_evidence: rec.supportingEvidence as unknown as Json,
      is_selected: false,
      created_by: userId,
    }));

    const { error: insertErr } = await supabase
      .from("niche_recommendations")
      .insert(rowsToInsert);

    if (insertErr) {
      throw new Error(
        `Gagal menyimpan rekomendasi niche ke database: ${insertErr.message}`
      );
    }

    const updatedList = await this.listRecommendations(workspaceId, userId);

    return {
      recommendations: updatedList,
      remainingCredits: result.billing.remainingBalance,
      totalTokens: result.usage.totalTokens,
    };
  }

  /**
   * Atomically selects the user's preferred niche via `public.select_preferred_niche`
   * and syncs `creator_profiles.primary_niche`.
   */
  static async selectPreferredNiche(
    workspaceId: string,
    userId: string,
    nicheId: string
  ): Promise<string> {
    const hasEditor = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!hasEditor) {
      throw new Error(
        "Akses ditolak: peran Editor, Admin, atau Owner diperlukan untuk memilih niche utama."
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("select_preferred_niche", {
      target_workspace_id: workspaceId,
      target_niche_id: nicheId,
    });

    if (error) {
      throw new Error(`Gagal memilih niche utama: ${error.message}`);
    }

    return typeof data === "string" ? data : "Niche terpilih";
  }
}
