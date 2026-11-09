import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { formatCreatorContextPromptBlock } from "@/lib/ai/context-builder";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import { RESEARCH_SYNTHESIS_JSON_SCHEMA } from "@/lib/ai/schemas/research-and-strategy-json-schemas";
import type { TextGenerationProvider } from "@/lib/ai/types";
import type { AiOperationType } from "@/lib/ai/token-budget";
import {
  collectResearchEvidence,
  isSafePublicHttpUrl,
  type CollectedExternalEvidence,
} from "@/lib/research/web-evidence-collector";
import {
  aiInterpretationItemSchema,
  aiResearchSynthesisOutputSchema,
  audienceInsightItemSchema,
  competitorInsightItemSchema,
  competitorObservedHookSchema,
  competitorProfileInputSchema,
  generateResearchRequestSchema,
  traceableTrendClaimSchema,
  verifiedFactItemSchema,
  type AiInterpretationItem,
  type AudienceInsightItem,
  type CompetitorInsightItem,
  type CompetitorObservedHook,
  type CompetitorProfileInput,
  type GenerateResearchRequest,
  type ResearchSourceRecord,
  type TraceableTrendClaim,
  type VerifiedFactItem,
} from "@/lib/validation/research-schemas";
import type {
  CompetitorProfileRow,
  Json,
  ResearchReportRow,
  ResearchReportType,
  ResearchSourceRow,
} from "@/lib/supabase/types";

export interface HydratedResearchReport {
  id: string;
  workspaceId: string;
  reportType: ResearchReportType;
  title: string;
  topicQuery: string;
  targetPlatform: string;
  summary: string;
  verifiedFacts: VerifiedFactItem[];
  aiInterpretations: AiInterpretationItem[];
  trendClaims: TraceableTrendClaim[];
  audienceInsights: AudienceInsightItem[];
  competitorInsights: CompetitorInsightItem[];
  actionableRecommendations: string[];
  dataLimitations: string;
  overallConfidence: "high" | "medium" | "low";
  realtimeDataAvailable: boolean;
  realtimeUnavailableReason: string | null;
  retrievedAt: string;
  sources: ResearchSourceRecord[];
}

export interface HydratedCompetitorProfile extends CompetitorProfileInput {
  id: string;
  lastObservedAt: string;
}

function parseJsonArray<T>(
  raw: unknown,
  parser: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }
): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const parsed = parser.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function mapReportRow(
  row: ResearchReportRow,
  sourceRows: ResearchSourceRow[]
): HydratedResearchReport {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    reportType: row.report_type,
    title: row.title,
    topicQuery: row.topic_query,
    targetPlatform: row.target_platform,
    summary: row.summary,
    verifiedFacts: parseJsonArray(row.verified_facts, verifiedFactItemSchema),
    aiInterpretations: parseJsonArray(row.ai_interpretations, aiInterpretationItemSchema),
    trendClaims: parseJsonArray(row.trend_claims, traceableTrendClaimSchema),
    audienceInsights: parseJsonArray(row.audience_insights, audienceInsightItemSchema),
    competitorInsights: parseJsonArray(
      row.competitor_insights,
      competitorInsightItemSchema
    ),
    actionableRecommendations: Array.isArray(row.actionable_recommendations)
      ? row.actionable_recommendations.filter((x): x is string => typeof x === "string")
      : [],
    dataLimitations: row.data_limitations,
    overallConfidence: row.overall_confidence,
    realtimeDataAvailable: row.realtime_data_available,
    realtimeUnavailableReason: row.realtime_unavailable_reason,
    retrievedAt: row.retrieved_at,
    sources: sourceRows.map((s) => ({
      sourceUrl: s.source_url,
      sourceTitle: s.source_title,
      retrievedAt: s.retrieved_at,
      relevantExtract: s.relevant_extract,
      dataLimitations: s.data_limitations,
      confidenceLevel: s.confidence_level,
      confidenceRationale: s.confidence_rationale,
      sourceOrigin: s.source_origin,
    })),
  };
}

function resolveOperationType(reportType: ResearchReportType): AiOperationType {
  if (reportType === "competitor") return "competitor_research_generation";
  if (reportType === "audience") return "audience_research_generation";
  return "trend_research_generation";
}

export class ResearchService {
  static async listResearchReports(
    workspaceId: string,
    userId: string,
    reportType?: ResearchReportType
  ): Promise<HydratedResearchReport[]> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!allowed) throw new Error("Akses ditolak ke laporan riset workspace.");

    const supabase = await createClient();
    let query = supabase
      .from("research_reports")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (reportType) {
      query = query.eq("report_type", reportType);
    }

    const [{ data: reportData }, { data: sourceData }] = await Promise.all([
      query,
      supabase
        .from("research_sources")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
    ]);

    const reports = (reportData ?? []) as ResearchReportRow[];
    const sources = (sourceData ?? []) as ResearchSourceRow[];
    const byReport = new Map<string, ResearchSourceRow[]>();
    for (const src of sources) {
      const list = byReport.get(src.report_id) ?? [];
      list.push(src);
      byReport.set(src.report_id, list);
    }

    return reports.map((r) => mapReportRow(r, byReport.get(r.id) ?? []));
  }

  static async listCompetitorProfiles(
    workspaceId: string,
    userId: string
  ): Promise<HydratedCompetitorProfile[]> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "viewer"
    );
    if (!allowed) throw new Error("Akses ditolak ke data kompetitor workspace.");

    const supabase = await createClient();
    const { data } = await supabase
      .from("competitor_profiles")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    return ((data ?? []) as CompetitorProfileRow[]).map((row) => ({
      id: row.id,
      handle: row.handle,
      displayName: row.display_name,
      platform: row.platform,
      profileUrl: row.profile_url,
      followerCountEstimate: row.follower_count_estimate,
      positioningSummary: row.positioning_summary,
      observedHooks: parseJsonArray<CompetitorObservedHook>(
        row.observed_hooks,
        competitorObservedHookSchema
      ),
      topPerformingTopics: row.top_performing_topics ?? [],
      contentGaps: row.content_gaps ?? [],
      evidenceNotes: row.evidence_notes,
      dataLimitations: row.data_limitations,
      lastObservedAt: row.last_observed_at,
    }));
  }

  static async saveCompetitorProfile(
    workspaceId: string,
    userId: string,
    rawInput: CompetitorProfileInput
  ): Promise<HydratedCompetitorProfile> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error(" Anda memerlukan akses Editor untuk menyimpan data kompetitor.");

    const parsed = competitorProfileInputSchema.parse(rawInput);
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const payload = {
      workspace_id: workspaceId,
      handle: parsed.handle,
      display_name: parsed.displayName,
      platform: parsed.platform,
      profile_url: parsed.profileUrl,
      follower_count_estimate: parsed.followerCountEstimate,
      positioning_summary: parsed.positioningSummary,
      observed_hooks: parsed.observedHooks as unknown as Json,
      top_performing_topics: parsed.topPerformingTopics,
      content_gaps: parsed.contentGaps,
      evidence_notes: parsed.evidenceNotes,
      data_limitations: parsed.dataLimitations,
      last_observed_at: nowIso,
    };

    if (parsed.id) {
      const { data, error } = await supabase
        .from("competitor_profiles")
        .update(payload)
        .eq("id", parsed.id)
        .eq("workspace_id", workspaceId)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message || "Gagal memperbarui profil kompetitor.");
      }
      const list = await this.listCompetitorProfiles(workspaceId, userId);
      return list.find((c) => c.id === (data as CompetitorProfileRow).id)!;
    }

    const { data, error } = await supabase
      .from("competitor_profiles")
      .insert({ ...payload, created_by: userId })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Gagal menambahkan profil kompetitor.");
    }
    const list = await this.listCompetitorProfiles(workspaceId, userId);
    return list.find((c) => c.id === (data as CompetitorProfileRow).id)!;
  }

  static async deleteCompetitorProfile(
    workspaceId: string,
    userId: string,
    competitorId: string
  ): Promise<void> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) throw new Error("Akses ditolak untuk menghapus kompetitor.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("competitor_profiles")
      .delete()
      .eq("id", competitorId)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
  }

  /**
   * Generates a source-backed Trend, Competitor, or Audience Research Dossier.
   * Enforces strict citation verification: zero fabricated URLs, zero invented statistics,
   * separated verified facts vs AI interpretations, and explicit realtime availability reporting.
   */
  static async generateResearchReport(
    workspaceId: string,
    userId: string,
    rawInput: GenerateResearchRequest,
    options?: {
      skipLiveNewsFetch?: boolean;
      customProviders?: {
        primary?: TextGenerationProvider;
        fallback?: TextGenerationProvider;
      };
    }
  ): Promise<{
    report: HydratedResearchReport;
    remainingCredits: number;
    totalTokens: number;
  }> {
    const allowed = await WorkspaceService.verifyWorkspaceAccess(
      userId,
      workspaceId,
      "editor"
    );
    if (!allowed) {
      throw new Error("Akses Editor diperlukan untuk menjalankan Research Engine.");
    }

    const input = generateResearchRequestSchema.parse(rawInput);
    const context = await CreatorContextService.getWorkspaceCreatorContext(
      workspaceId,
      userId
    );
    const competitors = await this.listCompetitorProfiles(workspaceId, userId);
    const selectedCompetitors =
      input.competitorIds.length > 0
        ? competitors.filter((c) => input.competitorIds.includes(c.id))
        : competitors.slice(0, 6);

    const evidence = await collectResearchEvidence({
      query: input.topicQuery,
      language: context.defaultLanguage,
      referenceUrls: input.referenceUrls,
      skipLiveNewsFetch: options?.skipLiveNewsFetch,
    });

    // Include verifiable competitor profile/hook URLs in candidate source map
    const candidateSourceMap = new Map<string, CollectedExternalEvidence>();
    for (const s of evidence.sources) {
      candidateSourceMap.set(s.sourceUrl, s);
    }
    for (const comp of selectedCompetitors) {
      if (comp.profileUrl && isSafePublicHttpUrl(comp.profileUrl)) {
        candidateSourceMap.set(comp.profileUrl, {
          sourceUrl: comp.profileUrl,
          sourceTitle: `Profil Kompetitor ${comp.handle} (${comp.platform})`,
          retrievedAt: comp.lastObservedAt,
          relevantExtract:
            comp.positioningSummary ||
            comp.evidenceNotes ||
            `Topik utama: ${comp.topPerformingTopics.join(", ") || "Pengamatan publik"}`,
          dataLimitations: comp.dataLimitations,
          confidenceLevel: "medium",
          confidenceRationale: "Bukti profil kompetitor tercatat di workspace.",
          sourceOrigin: "competitor_evidence",
        });
      }
      for (const h of comp.observedHooks) {
        if (h.sourcePostUrl && isSafePublicHttpUrl(h.sourcePostUrl)) {
          candidateSourceMap.set(h.sourcePostUrl, {
            sourceUrl: h.sourcePostUrl,
            sourceTitle: `Konten Kompetitor ${comp.handle}`,
            retrievedAt: comp.lastObservedAt,
            relevantExtract: `Hook teramati (${h.formatNote}): "${h.hookText}"`,
            dataLimitations: comp.dataLimitations,
            confidenceLevel: "high",
            confidenceRationale: "Tautan konten publik spesifik yang dicatat pengguna.",
            sourceOrigin: "competitor_evidence",
          });
        }
      }
    }

    const sourcesPromptSection =
      candidateSourceMap.size > 0
        ? Array.from(candidateSourceMap.values())
            .map(
              (s, i) =>
                `[Sumber #${i + 1}] Judul: ${s.sourceTitle}\nURL: ${s.sourceUrl}\nDiambil: ${s.retrievedAt}\nEkstrak: ${s.relevantExtract}\nLimitasi: ${s.dataLimitations}`
            )
            .join("\n\n")
        : "TIDAK ADA SUMBER EKSTERNAL PRA-AMBIL. Jika tool pencarian real-time juga tidak mengembalikan URL terverifikasi, biarkan verifiedFacts kosong [] dan tandai trendClaims sebagai qualitative_pattern_only.";

    const competitorPromptSection =
      selectedCompetitors.length > 0
        ? selectedCompetitors
            .map(
              (c) =>
                `- ${c.handle} (${c.platform}) | Pengikut: ${
                  c.followerCountEstimate !== null
                    ? `${c.followerCountEstimate} (estimasi pengamatan)`
                    : "Belum ada data"
                } | Positioning: ${c.positioningSummary || "-"} | Hook Teramati: ${
                  c.observedHooks.map((h) => h.hookText).join("; ") || "-"
                } | Celah Konten: ${c.contentGaps.join(", ") || "-"} | Catatan Bukti: ${
                  c.evidenceNotes || "-"
                }`
            )
            .join("\n")
        : "Belum ada profil kompetitor manual yang tercatat di workspace.";

    const systemPrompt = [
      "Anda adalah Research Agent di CreatorOS AI.",
      "TUGAS: Menyusun laporan riset (Trend / Competitor / Audience) berbasis bukti yang jujur, dapat ditelusuri, dan bebas halusinasi.",
      "ATURAN MUTLAK:",
      "1. JANGAN PERNAH mengarang angka statistik, persentase pertumbuhan palsu, volume pencarian fiktif, atau URL sumber palsu.",
      "2. Pisahkan secara tegas `verifiedFacts` (HANYA fakta yang didukung URL sumber nyata) dari `aiInterpretations` (penalaran & hipotesis strategis AI).",
      "3. Pada `verifiedFacts` dan `trendClaims`, HANYA rujuk URL yang benar-benar ada pada daftar sumber terverifikasi atau hasil Google Search grounding.",
      "4. Jika klaim tren bersifat pola kualitatif tanpa URL sumber langsung, gunakan `evidenceStatus: 'qualitative_pattern_only'` dan jelaskan batasannya.",
      "5. Jangan pernah menjanjikan penghasilan pasti atau jaminan viralitas.",
    ].join("\n");

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      `=== PERMINTAAN RISET (${input.reportType.toUpperCase()}) ===`,
      `Kueri Topik: ${input.topicQuery}`,
      `Platform Fokus: ${input.targetPlatform}`,
      "=== BUKTI SUMBER TERCATAT SAAT INI ===",
      sourcesPromptSection,
      "=== DATA KOMPETITOR TERCATAT DI WORKSPACE ===",
      competitorPromptSection,
    ].join("\n\n");

    const aiGen = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "ResearchAgent",
      operationType: resolveOperationType(input.reportType),
      preferredModel: context.defaultAiModel,
      systemPrompt,
      userPrompt,
      schemaName: "research_synthesis_dossier",
      jsonSchema: RESEARCH_SYNTHESIS_JSON_SCHEMA,
      zodSchema: aiResearchSynthesisOutputSchema,
      maxOutputTokens: 4500,
      enableWebGrounding: true,
      inputSummary: {
        reportType: input.reportType,
        topicQuery: input.topicQuery,
        targetPlatform: input.targetPlatform,
      },
      customProviders: options?.customProviders,
    });

    const reportRetrievedAt = new Date().toISOString();

    // Add real Gemini Google Search grounding citations into verified pool
    for (const cite of aiGen.groundingCitations) {
      if (isSafePublicHttpUrl(cite.url) && !candidateSourceMap.has(cite.url)) {
        candidateSourceMap.set(cite.url, {
          sourceUrl: cite.url,
          sourceTitle: cite.title || cite.url,
          retrievedAt: reportRetrievedAt,
          relevantExtract:
            cite.citedText && cite.citedText.trim().length >= 5
              ? cite.citedText.trim().slice(0, 900)
              : `Sumber web terverifikasi dari pencarian langsung untuk topik "${input.topicQuery}".`,
          dataLimitations:
            "Cuplikan web publik melalui Google Search grounding; metrik privat platform tidak tercakup.",
          confidenceLevel: "medium",
          confidenceRationale: "Ditemukan dan disitasi langsung oleh mesin pencarian web.",
          sourceOrigin: "web_grounding",
        });
      }
    }

    // Enrich existing verified sources with AI's structured assessment (never adding unverified URLs!)
    for (const assessment of aiGen.data.sourceAssessments) {
      const existing = candidateSourceMap.get(assessment.sourceUrl);
      if (existing) {
        candidateSourceMap.set(assessment.sourceUrl, {
          ...existing,
          relevantExtract: assessment.relevantExtract,
          dataLimitations: assessment.dataLimitations,
          confidenceLevel: assessment.confidenceLevel,
          confidenceRationale: assessment.confidenceRationale,
        });
      }
    }

    const verifiedUrls = new Set(candidateSourceMap.keys());
    const verifiedFacts: VerifiedFactItem[] = [];
    const extraInterpretations: AiInterpretationItem[] = [
      ...aiGen.data.aiInterpretations,
    ];

    for (const vf of aiGen.data.verifiedFacts) {
      const validUrls = vf.sourceUrls.filter((u) => verifiedUrls.has(u));
      if (validUrls.length > 0) {
        verifiedFacts.push({ ...vf, sourceUrls: validUrls });
      } else {
        extraInterpretations.push({
          interpretation: vf.fact,
          reasoningBasis:
            "Dipindahkan dari fakta ke interpretasi AI karena tidak memiliki tautan ke URL sumber eksternal yang terverifikasi.",
          confidence: "low",
        });
      }
    }

    const sanitizedTrendClaims: TraceableTrendClaim[] = aiGen.data.trendClaims.map(
      (tc) => {
        const validUrls = tc.supportingSourceUrls.filter((u) => verifiedUrls.has(u));
        if (validUrls.length === 0) {
          return {
            ...tc,
            evidenceStatus: "qualitative_pattern_only" as const,
            supportingSourceUrls: [],
            dataLimitation:
              tc.dataLimitation ||
              "Berdasarkan pola kualitatif tanpa URL sumber web publik spesifik.",
          };
        }
        return {
          ...tc,
          evidenceStatus: "verified_by_sources" as const,
          supportingSourceUrls: validUrls,
        };
      }
    );

    const realtimeDataAvailable =
      evidence.realtimeDataAvailable || aiGen.groundingCitations.length > 0;
    const realtimeUnavailableReason = realtimeDataAvailable
      ? null
      : evidence.realtimeUnavailableReason ||
        "Pencarian web real-time tidak mengembalikan sumber langsung untuk kueri ini; analisis menggunakan bukti workspace yang tersedia dan penalaran kualitatif terpisah.";

    const supabase = await createClient();
    const { data: insertedReport, error: reportErr } = await supabase
      .from("research_reports")
      .insert({
        workspace_id: workspaceId,
        report_type: input.reportType,
        title: aiGen.data.title,
        topic_query: input.topicQuery,
        target_platform: input.targetPlatform,
        summary: aiGen.data.summary,
        verified_facts: verifiedFacts as unknown as Json,
        ai_interpretations: extraInterpretations.slice(0, 8) as unknown as Json,
        trend_claims: sanitizedTrendClaims as unknown as Json,
        audience_insights: aiGen.data.audienceInsights as unknown as Json,
        competitor_insights: aiGen.data.competitorInsights as unknown as Json,
        actionable_recommendations: aiGen.data.actionableRecommendations as unknown as Json,
        data_limitations: aiGen.data.dataLimitations,
        overall_confidence: aiGen.data.overallConfidence,
        realtime_data_available: realtimeDataAvailable,
        realtime_unavailable_reason: realtimeUnavailableReason,
        retrieved_at: reportRetrievedAt,
        created_by: userId,
      })
      .select("*")
      .single();

    if (reportErr || !insertedReport) {
      throw new Error(reportErr?.message || "Gagal menyimpan laporan riset ke database.");
    }

    const reportRow = insertedReport as ResearchReportRow;
    let insertedSources: ResearchSourceRow[] = [];

    if (candidateSourceMap.size > 0) {
      const sourcePayloads = Array.from(candidateSourceMap.values()).map((s) => ({
        report_id: reportRow.id,
        workspace_id: workspaceId,
        source_url: s.sourceUrl,
        source_title: s.sourceTitle,
        retrieved_at: s.retrievedAt,
        relevant_extract: s.relevantExtract,
        data_limitations: s.dataLimitations,
        confidence_level: s.confidenceLevel,
        confidence_rationale: s.confidenceRationale,
        source_origin: s.sourceOrigin,
      }));

      const { data: srcData, error: srcErr } = await supabase
        .from("research_sources")
        .insert(sourcePayloads)
        .select("*");

      if (srcErr) {
        throw new Error(`Gagal menyimpan sumber riset: ${srcErr.message}`);
      }
      insertedSources = (srcData ?? []) as ResearchSourceRow[];
    }

    return {
      report: mapReportRow(reportRow, insertedSources),
      remainingCredits: aiGen.billing.remainingBalance,
      totalTokens: aiGen.usage.totalTokens,
    };
  }
}
