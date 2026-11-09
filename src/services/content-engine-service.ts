import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { ResearchService } from "@/services/research-service";
import { StrategyService } from "@/services/strategy-service";
import { formatCreatorContextPromptBlock } from "@/lib/ai/context-builder";
import { formatPlatformRulesPrompt, PLATFORM_RULES } from "@/lib/content/platform-rules";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import {
  CONTENT_PACKAGE_JSON_SCHEMA,
  IDEA_GENERATION_JSON_SCHEMA,
} from "@/lib/ai/schemas/content-engine-json-schemas";
import type { TextGenerationProvider } from "@/lib/ai/types";
import {
  adaptContentPlatformRequestSchema,
  aiContentPackageOutputSchema,
  aiIdeaBatchOutputSchema,
  generateContentPackageRequestSchema,
  hashtagTierSetSchema,
  hookVariantItemSchema,
  saveContentIdeaSchema,
  saveEditableContentPackageSchema,
  scriptCueItemSchema,
  type AdaptContentPlatformRequest,
  type GenerateContentPackageRequest,
  type HashtagTierSet,
  type HookVariantItem,
  type SaveContentIdeaInput,
  type SaveEditableContentPackageInput,
  type ScriptCueItem,
} from "@/lib/validation/strategy-and-content-schemas";
import type {
  ContentIdeaAngle,
  ContentIdeaRow,
  ContentIdeaStatus,
  ContentItemRow,
  ContentItemStage,
  Json,
  ScriptFramework,
  ScriptRow,
  SocialPlatformId,
} from "@/lib/supabase/types";

export interface HydratedContentIdea {
  id: string;
  workspaceId: string;
  pillarId: string | null;
  researchReportId: string | null;
  title: string;
  hookConcept: string;
  angleType: ContentIdeaAngle;
  targetPlatform: SocialPlatformId;
  opportunityScore: number;
  opportunityRationale: string;
  researchTrace: string;
  status: ContentIdeaStatus;
  updatedAt: string;
}

export interface HydratedScriptVersion {
  id: string;
  version: number;
  targetPlatform: SocialPlatformId;
  framework: ScriptFramework;
  openingHook: string;
  bodyContent: string;
  closingCta: string;
  visualAndAudioCues: ScriptCueItem[];
  estimatedDurationSeconds: number;
  isCurrent: boolean;
  updatedAt: string;
}

export interface HydratedContentPackage {
  id: string;
  workspaceId: string;
  pillarId: string | null;
  ideaId: string | null;
  researchReportId: string | null;
  sourceContentItemId: string | null;
  title: string;
  primaryPlatform: SocialPlatformId;
  contentFormat: string;
  stage: ContentItemStage;
  hookVariants: HookVariantItem[];
  caption: string;
  callToAction: string;
  ctaVariants: string[];
  hashtags: string[];
  hashtagTiers: HashtagTierSet;
  platformAdaptationNotes: string;
  currentScript: HydratedScriptVersion | null;
  versionCount: number;
  updatedAt: string;
}

function parseArray<T>(
  raw: unknown,
  parser: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }
): T[] {
  if (!Array.isArray(raw)) return [];
  const res: T[] = [];
  for (const el of raw) {
    const p = parser.safeParse(el);
    if (p.success) res.push(p.data);
  }
  return res;
}

function normalizeHashtag(tag: string): string {
  const cleaned = tag.trim().replace(/\s+/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
}

function mapIdeaRow(row: ContentIdeaRow): HydratedContentIdea {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    pillarId: row.pillar_id,
    researchReportId: row.research_report_id,
    title: row.title,
    hookConcept: row.hook_concept,
    angleType: row.angle_type,
    targetPlatform: row.target_platform,
    opportunityScore: row.opportunity_score,
    opportunityRationale: row.opportunity_rationale,
    researchTrace: row.research_trace,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapContentPackage(
  item: ContentItemRow,
  scripts: ScriptRow[]
): HydratedContentPackage {
  const sorted = [...scripts].sort((a, b) => b.version - a.version);
  const activeRow = sorted.find((s) => s.is_current) ?? sorted[0] ?? null;
  const tiersParsed = hashtagTierSetSchema.safeParse(item.hashtag_tiers);

  return {
    id: item.id,
    workspaceId: item.workspace_id,
    pillarId: item.pillar_id,
    ideaId: item.idea_id,
    researchReportId: item.research_report_id,
    sourceContentItemId: item.source_content_item_id,
    title: item.title,
    primaryPlatform: item.primary_platform,
    contentFormat: item.content_format,
    stage: item.stage,
    hookVariants: parseArray(item.hook_variants, hookVariantItemSchema),
    caption: item.caption,
    callToAction: item.call_to_action,
    ctaVariants: Array.isArray(item.cta_variants)
      ? item.cta_variants.filter((v): v is string => typeof v === "string")
      : [],
    hashtags: item.hashtags ?? [],
    hashtagTiers: tiersParsed.success
      ? tiersParsed.data
      : { broad: [], niche: [], specific: [] },
    platformAdaptationNotes: item.platform_adaptation_notes,
    currentScript: activeRow
      ? {
          id: activeRow.id,
          version: activeRow.version,
          targetPlatform: activeRow.target_platform,
          framework: activeRow.framework,
          openingHook: activeRow.opening_hook,
          bodyContent: activeRow.body_content,
          closingCta: activeRow.closing_cta,
          visualAndAudioCues: parseArray(
            activeRow.visual_and_audio_cues,
            scriptCueItemSchema
          ),
          estimatedDurationSeconds: activeRow.estimated_duration_seconds,
          isCurrent: activeRow.is_current,
          updatedAt: activeRow.updated_at,
        }
      : null,
    versionCount: sorted.length,
    updatedAt: item.updated_at,
  };
}

export class ContentEngineService {
  static async listIdeas(
    workspaceId: string,
    userId: string
  ): Promise<HydratedContentIdea[]> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!ok) throw new Error("Akses ditolak ke daftar ide konten.");
    const supabase = await createClient();
    const { data } = await supabase
      .from("content_ideas")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    return ((data ?? []) as ContentIdeaRow[]).map(mapIdeaRow);
  }

  static async saveIdea(
    workspaceId: string,
    userId: string,
    rawInput: SaveContentIdeaInput
  ): Promise<HydratedContentIdea> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!ok) throw new Error("Akses Editor diperlukan untuk menyimpan ide konten.");

    const input = saveContentIdeaSchema.parse(rawInput);
    const supabase = await createClient();
    const payload = {
      workspace_id: workspaceId,
      pillar_id: input.pillarId,
      research_report_id: input.researchReportId,
      title: input.title,
      hook_concept: input.hookConcept,
      angle_type: input.angleType,
      target_platform: input.targetPlatform,
      opportunity_score: input.opportunityScore,
      opportunity_rationale: input.opportunityRationale,
      research_trace: input.researchTrace,
      status: input.status,
    };

    if (input.id) {
      const { data, error } = await supabase
        .from("content_ideas")
        .update(payload)
        .eq("id", input.id)
        .eq("workspace_id", workspaceId)
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message || "Gagal memperbarui ide.");
      return mapIdeaRow(data as ContentIdeaRow);
    }

    const { data, error } = await supabase
      .from("content_ideas")
      .insert({ ...payload, created_by: userId })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message || "Gagal menyimpan ide baru.");
    return mapIdeaRow(data as ContentIdeaRow);
  }

  static async deleteIdea(
    workspaceId: string,
    userId: string,
    ideaId: string
  ): Promise<void> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!ok) throw new Error("Akses Editor diperlukan untuk menghapus ide.");
    const supabase = await createClient();
    const { error } = await supabase
      .from("content_ideas")
      .delete()
      .eq("id", ideaId)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
  }

  static async generateIdeas(
    workspaceId: string,
    userId: string,
    params: {
      targetPlatform: SocialPlatformId;
      count?: number;
      pillarId?: string | null;
      researchReportId?: string | null;
      customTopicFocus?: string;
    },
    customProviders?: {
      primary?: TextGenerationProvider;
      fallback?: TextGenerationProvider;
    }
  ): Promise<{
    ideas: HydratedContentIdea[];
    remainingCredits: number;
    totalTokens: number;
  }> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!ok) throw new Error("Akses Editor diperlukan untuk menghasilkan ide AI.");

    const [context, strategies, reports] = await Promise.all([
      CreatorContextService.getWorkspaceCreatorContext(workspaceId, userId),
      StrategyService.listStrategiesWithPillars(workspaceId, userId),
      ResearchService.listResearchReports(workspaceId, userId),
    ]);

    const activePillars = (strategies.find((s) => s.isActive) ?? strategies[0])?.pillars ?? [];
    const targetPillar = params.pillarId
      ? activePillars.find((p) => p.id === params.pillarId) ?? null
      : null;
    const targetReport = params.researchReportId
      ? reports.find((r) => r.id === params.researchReportId) ?? null
      : reports[0] ?? null;

    const count = Math.min(Math.max(params.count ?? 6, 4), 10);

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      formatPlatformRulesPrompt(params.targetPlatform),
      targetPillar
        ? `Fokus Pilar Konten: ${targetPillar.name} (${targetPillar.description})`
        : "",
      targetReport
        ? `Temuan Riset Rujukan (${targetReport.title}): ${targetReport.summary}\nKlaim Tren: ${targetReport.trendClaims.map((c) => c.claim).join("; ")}`
        : "",
      params.customTopicFocus ? `Fokus Spesifik Pengguna: ${params.customTopicFocus}` : "",
      `Hasilkan tepat ${count} ide konten variatif dengan hook tajam dan rasional peluang jujur.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const aiGen = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "IdeaGeneratorAgent",
      operationType: "content_idea_generation",
      preferredModel: context.defaultAiModel,
      systemPrompt:
        "Anda adalah Idea Generator Agent di CreatorOS AI. Buat sudut pandang konten orisinal (curiosity, contrarian, tutorial, case_study, story, myth_busting) yang patuh Creator DNA, Brand Context, aturan platform, dan bebas janji viral/penghasilan.",
      userPrompt,
      schemaName: "content_idea_batch",
      jsonSchema: IDEA_GENERATION_JSON_SCHEMA,
      zodSchema: aiIdeaBatchOutputSchema,
      maxOutputTokens: 3600,
      inputSummary: { platform: params.targetPlatform, count },
      customProviders,
    });

    const supabase = await createClient();
    const rowsToInsert = aiGen.data.ideas.map((idea) => {
      const matchedPillar =
        targetPillar ??
        activePillars.find(
          (p) => p.name.toLowerCase() === idea.suggestedPillarName.toLowerCase()
        ) ??
        null;
      return {
        workspace_id: workspaceId,
        pillar_id: matchedPillar?.id ?? null,
        research_report_id: targetReport?.id ?? null,
        title: idea.title,
        hook_concept: idea.hookConcept,
        angle_type: idea.angleType,
        target_platform: idea.targetPlatform,
        opportunity_score: idea.opportunityScore,
        opportunity_rationale: idea.opportunityRationale,
        research_trace: idea.researchTrace,
        status: "backlog" as const,
        created_by: userId,
      };
    });

    const { data, error } = await supabase
      .from("content_ideas")
      .insert(rowsToInsert)
      .select("*");
    if (error || !data) throw new Error(error?.message || "Gagal menyimpan daftar ide.");

    return {
      ideas: (data as ContentIdeaRow[]).map(mapIdeaRow),
      remainingCredits: aiGen.billing.remainingBalance,
      totalTokens: aiGen.usage.totalTokens,
    };
  }

  static async listContentPackages(
    workspaceId: string,
    userId: string
  ): Promise<HydratedContentPackage[]> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!ok) throw new Error("Akses ditolak ke Content Studio.");

    const supabase = await createClient();
    const [{ data: itemsData }, { data: scriptsData }] = await Promise.all([
      supabase
        .from("content_items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("scripts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("version", { ascending: false }),
    ]);

    const items = (itemsData ?? []) as ContentItemRow[];
    const scripts = (scriptsData ?? []) as ScriptRow[];
    const byItem = new Map<string, ScriptRow[]>();
    for (const s of scripts) {
      const list = byItem.get(s.content_item_id) ?? [];
      list.push(s);
      byItem.set(s.content_item_id, list);
    }

    return items.map((item) => mapContentPackage(item, byItem.get(item.id) ?? []));
  }

  static async generateContentPackage(
    workspaceId: string,
    userId: string,
    rawInput: GenerateContentPackageRequest,
    customProviders?: {
      primary?: TextGenerationProvider;
      fallback?: TextGenerationProvider;
    }
  ): Promise<{
    contentPackage: HydratedContentPackage;
    remainingCredits: number;
    totalTokens: number;
  }> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!ok) throw new Error("Akses Editor diperlukan untuk membuat paket konten.");

    const input = generateContentPackageRequestSchema.parse(rawInput);
    const [context, ideas, reports] = await Promise.all([
      CreatorContextService.getWorkspaceCreatorContext(workspaceId, userId),
      this.listIdeas(workspaceId, userId),
      ResearchService.listResearchReports(workspaceId, userId),
    ]);

    const linkedIdea = input.ideaId ? ideas.find((i) => i.id === input.ideaId) : null;
    const linkedReport = input.researchReportId
      ? reports.find((r) => r.id === input.researchReportId)
      : reports[0] ?? null;

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      formatPlatformRulesPrompt(input.targetPlatform),
      `Framework Copywriting Wajib: ${input.framework}`,
      `Target Durasi Estimasi: ~${input.targetDurationSeconds} detik`,
      `Brief / Topik Utama: ${input.topicOrBrief}`,
      linkedIdea
        ? `Ide Terkait: ${linkedIdea.title} | Konsep Hook Awal: ${linkedIdea.hookConcept}`
        : "",
      linkedReport
        ? `Temuan Riset Pendukung (${linkedReport.title}): ${linkedReport.summary}\nFakta Sumber: ${
            linkedReport.verifiedFacts.map((f) => f.fact).join("; ") ||
            "Gunakan analisis tanpa mengarang angka statistik."
          }`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const aiGen = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "ScriptwriterAgent",
      operationType: "content_package_generation",
      preferredModel: context.defaultAiModel,
      systemPrompt:
        "Anda adalah Scriptwriter & Copywriter Agent di CreatorOS AI. Hasilkan paket konten platform-spesifik yang siap rekam/publikasi (multi-hook, skrip penuh, arahan visual/audio, caption rapi sesuai batas karakter platform, CTA etis, dan hashtag berjenjang) tanpa mengarang statistik atau menjanjikan viral/penghasilan.",
      userPrompt,
      schemaName: "content_package_output",
      jsonSchema: CONTENT_PACKAGE_JSON_SCHEMA,
      zodSchema: aiContentPackageOutputSchema,
      maxOutputTokens: 4800,
      inputSummary: {
        targetPlatform: input.targetPlatform,
        framework: input.framework,
      },
      customProviders,
    });

    const pkg = await this.persistNewContentPackage(workspaceId, userId, {
      pillarId: input.pillarId ?? linkedIdea?.pillarId ?? null,
      ideaId: linkedIdea?.id ?? null,
      researchReportId: linkedReport?.id ?? null,
      sourceContentItemId: null,
      targetPlatform: input.targetPlatform,
      output: aiGen.data,
    });

    return {
      contentPackage: pkg,
      remainingCredits: aiGen.billing.remainingBalance,
      totalTokens: aiGen.usage.totalTokens,
    };
  }

  static async adaptContentToPlatform(
    workspaceId: string,
    userId: string,
    rawInput: AdaptContentPlatformRequest,
    customProviders?: {
      primary?: TextGenerationProvider;
      fallback?: TextGenerationProvider;
    }
  ): Promise<{
    contentPackage: HydratedContentPackage;
    remainingCredits: number;
    totalTokens: number;
  }> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!ok) throw new Error("Akses Editor diperlukan untuk adaptasi lintas platform.");

    const input = adaptContentPlatformRequestSchema.parse(rawInput);
    const [context, packages] = await Promise.all([
      CreatorContextService.getWorkspaceCreatorContext(workspaceId, userId),
      this.listContentPackages(workspaceId, userId),
    ]);

    const sourcePkg = packages.find((p) => p.id === input.sourceContentItemId);
    if (!sourcePkg || !sourcePkg.currentScript) {
      throw new Error("Konten sumber atau skrip aktif tidak ditemukan di workspace ini.");
    }

    const targetSpec = PLATFORM_RULES[input.targetPlatform];
    const framework = input.targetFramework ?? sourcePkg.currentScript.framework;

    const userPrompt = [
      formatCreatorContextPromptBlock(context),
      formatPlatformRulesPrompt(input.targetPlatform),
      `=== KONTEN SUMBER (${sourcePkg.primaryPlatform.toUpperCase()}) YANG AKAN DIADAPTASI KE ${targetSpec.label.toUpperCase()} ===`,
      `Judul Asal: ${sourcePkg.title}`,
      `Hook Asal: ${sourcePkg.currentScript.openingHook}`,
      `Isi Skrip Asal:\n${sourcePkg.currentScript.bodyContent}`,
      `CTA Asal: ${sourcePkg.currentScript.closingCta}`,
      `Caption Asal:\n${sourcePkg.caption}`,
      `INSTRUKSI ADAPTASI: Tulis ulang struktur hook, pacing kalimat, durasi (~${targetSpec.optimalDurationSeconds.recommended} detik), panjang caption (maks ${targetSpec.maxCaptionLength} karakter), mekanika CTA, dan jumlah hashtag (${targetSpec.recommendedHashtagCount.min}-${targetSpec.recommendedHashtagCount.max}) agar 100% native untuk ${targetSpec.label} dengan framework ${framework}.`,
    ].join("\n\n");

    const aiGen = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "PlatformAdapterAgent",
      operationType: "platform_content_adaptation",
      preferredModel: context.defaultAiModel,
      systemPrompt:
        "Anda adalah Platform Adaptation Specialist di CreatorOS AI. Adaptasikan konten ke platform target secara native (bukan sekadar salin-tempel), patuhi batas karakter, gaya audiens platform, dan jaga keaslian Creator DNA tanpa klaim berlebihan.",
      userPrompt,
      schemaName: "adapted_content_package_output",
      jsonSchema: CONTENT_PACKAGE_JSON_SCHEMA,
      zodSchema: aiContentPackageOutputSchema,
      maxOutputTokens: 4500,
      inputSummary: {
        sourceContentItemId: sourcePkg.id,
        fromPlatform: sourcePkg.primaryPlatform,
        targetPlatform: input.targetPlatform,
      },
      customProviders,
    });

    const adapted = await this.persistNewContentPackage(workspaceId, userId, {
      pillarId: sourcePkg.pillarId,
      ideaId: sourcePkg.ideaId,
      researchReportId: sourcePkg.researchReportId,
      sourceContentItemId: sourcePkg.id,
      targetPlatform: input.targetPlatform,
      output: aiGen.data,
    });

    return {
      contentPackage: adapted,
      remainingCredits: aiGen.billing.remainingBalance,
      totalTokens: aiGen.usage.totalTokens,
    };
  }

  private static async persistNewContentPackage(
    workspaceId: string,
    userId: string,
    params: {
      pillarId: string | null;
      ideaId: string | null;
      researchReportId: string | null;
      sourceContentItemId: string | null;
      targetPlatform: SocialPlatformId;
      output: ReturnType<typeof aiContentPackageOutputSchema.parse>;
    }
  ): Promise<HydratedContentPackage> {
    const supabase = await createClient();
    const spec = PLATFORM_RULES[params.targetPlatform];
    const normalizedTags = Array.from(
      new Set(params.output.hashtags.map(normalizeHashtag).filter(Boolean))
    ).slice(0, Math.max(spec.recommendedHashtagCount.max, 6));

    const { data: itemData, error: itemErr } = await supabase
      .from("content_items")
      .insert({
        workspace_id: workspaceId,
        pillar_id: params.pillarId,
        idea_id: params.ideaId,
        research_report_id: params.researchReportId,
        source_content_item_id: params.sourceContentItemId,
        title: params.output.title,
        primary_platform: params.targetPlatform,
        target_platforms: [params.targetPlatform],
        content_format: params.output.contentFormat,
        stage: "scripting",
        hook_variants: params.output.hookVariants as unknown as Json,
        caption: params.output.caption.slice(0, spec.maxCaptionLength),
        call_to_action: params.output.closingCta,
        cta_variants: params.output.ctaVariants as unknown as Json,
        hashtags: normalizedTags,
        hashtag_tiers: params.output.hashtagTiers as unknown as Json,
        platform_adaptation_notes: params.output.platformAdaptationNotes,
        created_by: userId,
      })
      .select("*")
      .single();

    if (itemErr || !itemData) {
      throw new Error(itemErr?.message || "Gagal menyimpan item konten.");
    }

    const itemRow = itemData as ContentItemRow;
    const { error: scriptRpcErr } = await supabase.rpc("save_script_version", {
      target_workspace_id: workspaceId,
      target_content_item_id: itemRow.id,
      p_target_platform: params.targetPlatform,
      p_framework: params.output.framework,
      p_opening_hook: params.output.openingHook,
      p_body_content: params.output.bodyContent,
      p_closing_cta: params.output.closingCta,
      p_visual_cues: params.output.visualAndAudioCues as unknown as Json,
      p_duration_seconds: params.output.estimatedDurationSeconds,
    });

    if (scriptRpcErr) {
      throw new Error(`Gagal menyimpan versi skrip: ${scriptRpcErr.message}`);
    }

    if (params.ideaId) {
      await supabase
        .from("content_ideas")
        .update({ status: "in_production" })
        .eq("id", params.ideaId)
        .eq("workspace_id", workspaceId);
    }

    const all = await this.listContentPackages(workspaceId, userId);
    return all.find((p) => p.id === itemRow.id)!;
  }

  /**
   * Saves manual edits (or manual new drafts) for a Content Item + Script.
   */
  static async saveEditableContentPackage(
    workspaceId: string,
    userId: string,
    rawInput: SaveEditableContentPackageInput
  ): Promise<HydratedContentPackage> {
    const ok = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!ok) throw new Error("Akses Editor diperlukan untuk menyimpan perubahan skrip.");

    const input = saveEditableContentPackageSchema.parse(rawInput);
    const supabase = await createClient();
    const spec = PLATFORM_RULES[input.primaryPlatform];
    const cleanTags = Array.from(
      new Set(input.hashtags.map(normalizeHashtag).filter(Boolean))
    );

    let contentItemId = input.contentItemId;

    if (contentItemId) {
      const { error } = await supabase
        .from("content_items")
        .update({
          title: input.title,
          primary_platform: input.primaryPlatform,
          target_platforms: [input.primaryPlatform],
          content_format: input.contentFormat,
          stage: input.stage,
          hook_variants: input.hookVariants as unknown as Json,
          caption: input.caption.slice(0, spec.maxCaptionLength),
          call_to_action: input.closingCta,
          cta_variants: input.ctaVariants as unknown as Json,
          hashtags: cleanTags,
          platform_adaptation_notes: input.platformAdaptationNotes,
        })
        .eq("id", contentItemId)
        .eq("workspace_id", workspaceId);

      if (error) throw new Error(`Gagal memperbarui item konten: ${error.message}`);
    } else {
      const { data, error } = await supabase
        .from("content_items")
        .insert({
          workspace_id: workspaceId,
          pillar_id: input.pillarId,
          idea_id: input.ideaId,
          research_report_id: input.researchReportId,
          title: input.title,
          primary_platform: input.primaryPlatform,
          target_platforms: [input.primaryPlatform],
          content_format: input.contentFormat,
          stage: input.stage,
          hook_variants: input.hookVariants as unknown as Json,
          caption: input.caption.slice(0, spec.maxCaptionLength),
          call_to_action: input.closingCta,
          cta_variants: input.ctaVariants as unknown as Json,
          hashtags: cleanTags,
          platform_adaptation_notes: input.platformAdaptationNotes,
          created_by: userId,
        })
        .select("*")
        .single();

      if (error || !data) throw new Error(error?.message || "Gagal membuat item konten.");
      contentItemId = (data as ContentItemRow).id;
    }

    if (input.scriptId && !input.saveAsNewScriptVersion) {
      const { error: updScriptErr } = await supabase
        .from("scripts")
        .update({
          target_platform: input.primaryPlatform,
          framework: input.framework,
          opening_hook: input.openingHook,
          body_content: input.bodyContent,
          closing_cta: input.closingCta,
          visual_and_audio_cues: input.visualAndAudioCues as unknown as Json,
          estimated_duration_seconds: input.estimatedDurationSeconds,
        })
        .eq("id", input.scriptId)
        .eq("workspace_id", workspaceId);

      if (updScriptErr) {
        throw new Error(`Gagal memperbarui skrip: ${updScriptErr.message}`);
      }
    } else {
      const { error: verErr } = await supabase.rpc("save_script_version", {
        target_workspace_id: workspaceId,
        target_content_item_id: contentItemId,
        p_target_platform: input.primaryPlatform,
        p_framework: input.framework,
        p_opening_hook: input.openingHook,
        p_body_content: input.bodyContent,
        p_closing_cta: input.closingCta,
        p_visual_cues: input.visualAndAudioCues as unknown as Json,
        p_duration_seconds: input.estimatedDurationSeconds,
      });
      if (verErr) throw new Error(`Gagal menyimpan versi skrip: ${verErr.message}`);
    }

    const packages = await this.listContentPackages(workspaceId, userId);
    return packages.find((p) => p.id === contentItemId)!;
  }
}
