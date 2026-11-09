import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { MediaStorageService } from "@/services/media-storage-service";
import { MediaWorkerService } from "@/services/media-worker-service";
import { ImageProviderRegistry } from "@/lib/media/providers/image-provider";
import { VoiceProviderRegistry } from "@/lib/media/providers/voice-provider";
import { VideoSynthesizer } from "@/lib/media/video-synthesizer";
import { SubtitleGenerator } from "@/lib/media/subtitle-generator";
import { AI_OPERATION_CREDIT_COSTS } from "@/lib/ai/token-budget";
import { executeValidatedStructuredGeneration } from "@/lib/ai/provider-registry";
import { AI_STORYBOARD_BREAKDOWN_JSON_SCHEMA } from "@/lib/ai/schemas/production-studio-json-schemas";
import {
  aiStoryboardBreakdownOutputSchema,
  type StoryboardInput,
  type ImageGenerationRequest,
  type VoiceGenerationRequest,
  type VideoGenerationRequest,
  type VideoExportRequest,
  type SubtitleCue,
  type TimelineProjectData,
} from "@/lib/validation/production-schemas";
import type {
  StoryboardRow,
  MediaAssetRow,
  GenerationJobRow,
  VideoProjectRow,
  MediaAssetType,
  VideoResolution,
  Json,
} from "@/lib/supabase/types";

export class ProductionStudioService {
  // ============================================================================
  // 1. STORYBOARD STUDIO
  // ============================================================================

  static async listStoryboards(
    workspaceId: string,
    userId: string
  ): Promise<StoryboardRow[]> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) throw new Error("Akses ditolak ke workspace ini.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("storyboards")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Gagal memuat storyboard: ${error.message}`);
    return (data as StoryboardRow[]) || [];
  }

  static async getStoryboard(
    workspaceId: string,
    userId: string,
    storyboardId: string
  ): Promise<StoryboardRow | null> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) throw new Error("Akses ditolak ke workspace ini.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("storyboards")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", storyboardId)
      .maybeSingle();

    if (error) throw new Error(`Gagal memuat storyboard: ${error.message}`);
    return (data as StoryboardRow) || null;
  }

  static async saveStoryboard(
    workspaceId: string,
    userId: string,
    input: StoryboardInput
  ): Promise<string> {
    const hasEditorAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!hasEditorAccess) {
      throw new Error("Peran Editor, Admin, atau Owner diperlukan untuk menyimpan storyboard.");
    }

    const supabase = await createClient();
    let totalSec = 0;
    for (const sc of input.scenes) {
      totalSec += sc.durationSeconds || 5;
    }
    if (totalSec <= 0) totalSec = 60;

    if (input.storyboardId) {
      const { data, error } = await supabase
        .from("storyboards")
        .update({
          title: input.title.trim(),
          visual_theme: input.visualTheme || "cinematic",
          content_item_id: input.contentItemId || null,
          scenes: input.scenes as unknown as Json,
          total_duration_seconds: totalSec,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.storyboardId)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single();

      if (error) throw new Error(`Gagal memperbarui storyboard: ${error.message}`);
      return data.id;
    }

    const { data, error } = await supabase
      .from("storyboards")
      .insert({
        workspace_id: workspaceId,
        content_item_id: input.contentItemId || null,
        title: input.title.trim(),
        visual_theme: input.visualTheme || "cinematic",
        scenes: input.scenes as unknown as Json,
        total_duration_seconds: totalSec,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Gagal membuat storyboard: ${error.message}`);
    return data.id;
  }

  static async generateAiStoryboard(
    workspaceId: string,
    userId: string,
    params: {
      scriptText: string;
      title: string;
      visualTheme?: string;
      contentItemId?: string;
    }
  ) {
    const requiredCredits = AI_OPERATION_CREDIT_COSTS.storyboard_generation;
    await UsageBillingService.assertSufficientCredits(workspaceId, userId, requiredCredits);

    const systemPrompt = `Anda adalah Director of Photography dan Senior Video Producer profesional.
Tugas Anda adalah mengonversi naskah video menjadi breakdown adegan (storyboard scene-by-scene) yang siap produksi.
Setiap adegan harus memiliki:
- sceneNumber (1, 2, 3...)
- durationSeconds (3-10 detik)
- shotType ('close_up' | 'medium' | 'wide' | 'over_shoulder' | 'aerial' | 'pov')
- shotDescription (deskripsi subjek dan aksi secara visual konkret)
- visualDirection (gerakan kamera, tata cahaya, sudut framing)
- voiceoverText (kalimat naskah yang diucapkan pada adegan tersebut)
- subtitleText (teks ringkas untuk subtitle di layar)
- transitionSuggestion ('cut' | 'fade' | 'dissolve' | 'wipe' | 'zoom_in')`;

    const userPrompt = `Judul: ${params.title}
Tema Visual: ${params.visualTheme || "Cinematic Modern"}
Naskah:
${params.scriptText}`;

    const result = await executeValidatedStructuredGeneration({
      workspaceId,
      userId,
      agentName: "StoryboardDirectorAgent",
      operationType: "storyboard_generation",
      systemPrompt,
      userPrompt,
      schemaName: "ai_storyboard_breakdown",
      jsonSchema: AI_STORYBOARD_BREAKDOWN_JSON_SCHEMA,
      zodSchema: aiStoryboardBreakdownOutputSchema,
      maxOutputTokens: 3000,
      inputSummary: {
        title: params.title,
        theme: params.visualTheme || "cinematic",
      },
    });

    return result.data;
  }

  // ============================================================================
  // 2. IMAGE STUDIO
  // ============================================================================

  static async generateImage(
    workspaceId: string,
    userId: string,
    request: ImageGenerationRequest
  ): Promise<MediaAssetRow> {
    const requiredCredits = AI_OPERATION_CREDIT_COSTS.image_generation;
    await UsageBillingService.assertSufficientCredits(workspaceId, userId, requiredCredits);

    const provider = ImageProviderRegistry.getProvider();
    const generationResult = await provider.generateImages(request);
    const imgItem = generationResult.images[0];

    if (!imgItem) {
      throw new Error("Tidak ada gambar yang berhasil dihasilkan oleh provider.");
    }

    // Persist to real media storage
    const stored = await MediaStorageService.saveMediaBuffer(
      imgItem.buffer,
      imgItem.mimeType,
      `${request.mode}_${request.prompt.slice(0, 20)}`,
      workspaceId
    );

    // Save record to media_assets
    const supabase = await createClient();
    const assetType =
      request.mode === "thumbnail"
        ? "thumbnail"
        : request.mode === "brand_visual"
          ? "brand_visual"
          : "image";

    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        workspace_id: workspaceId,
        content_item_id: request.contentItemId || null,
        storyboard_id: request.storyboardId || null,
        asset_type: assetType,
        title: request.prompt.slice(0, 80),
        storage_path: stored.storagePath,
        public_url: stored.publicUrl,
        mime_type: stored.mimeType,
        file_size_bytes: stored.fileSizeBytes,
        dimensions: imgItem.dimensions as unknown as Json,
        metadata: {
          prompt: request.prompt,
          mode: request.mode,
          style: request.style,
          aspectRatio: request.aspectRatio,
          provider: generationResult.provider,
          sceneNumber: request.sceneNumber || null,
        } as unknown as Json,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Gagal menyimpan aset gambar: ${error.message}`);

    // Deduct credits & record usage
    await UsageBillingService.recordExecutionUsage({
      workspaceId,
      userId,
      agentName: "ImageStudioAgent",
      operationType: "image_generation",
      provider: generationResult.provider,
      modelId: "imagen-3",
      promptTokens: 150,
      completionTokens: 250,
      totalTokens: 400,
      costUsd: 0.02,
      creditsToDeduct: requiredCredits,
      durationMs: 1200,
      status: "success",
      inputSummary: { prompt: request.prompt, mode: request.mode },
      outputSummary: { assetId: data.id, publicUrl: stored.publicUrl },
    });

    return data as MediaAssetRow;
  }

  // ============================================================================
  // 3. VOICE STUDIO
  // ============================================================================

  static async generateVoiceover(
    workspaceId: string,
    userId: string,
    request: VoiceGenerationRequest
  ): Promise<MediaAssetRow> {
    const requiredCredits = AI_OPERATION_CREDIT_COSTS.voice_generation;
    await UsageBillingService.assertSufficientCredits(workspaceId, userId, requiredCredits);

    const provider = VoiceProviderRegistry.getProvider();
    const generationResult = await provider.generateSpeech(request);

    // Persist real WAV/MP3 file
    const stored = await MediaStorageService.saveMediaBuffer(
      generationResult.audioBuffer,
      generationResult.mimeType,
      `voice_${request.personaId}`,
      workspaceId
    );

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        workspace_id: workspaceId,
        content_item_id: request.contentItemId || null,
        storyboard_id: request.storyboardId || null,
        asset_type: "voiceover",
        title: `Voiceover: ${request.text.slice(0, 50)}...`,
        storage_path: stored.storagePath,
        public_url: stored.publicUrl,
        mime_type: stored.mimeType,
        file_size_bytes: stored.fileSizeBytes,
        duration_seconds: generationResult.durationSeconds,
        dimensions: {} as unknown as Json,
        metadata: {
          text: request.text,
          language: request.language,
          personaId: request.personaId,
          speed: request.speed,
          pitch: request.pitch,
          provider: generationResult.provider,
          sceneNumber: request.sceneNumber || null,
        } as unknown as Json,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Gagal menyimpan aset audio: ${error.message}`);

    await UsageBillingService.recordExecutionUsage({
      workspaceId,
      userId,
      agentName: "VoiceStudioAgent",
      operationType: "voice_generation",
      provider: generationResult.provider,
      modelId: "tts-v2",
      promptTokens: request.text.length,
      completionTokens: Math.floor(generationResult.durationSeconds * 50),
      totalTokens: request.text.length + 200,
      costUsd: 0.015,
      creditsToDeduct: requiredCredits,
      durationMs: 950,
      status: "success",
      inputSummary: { text: request.text.slice(0, 60), persona: request.personaId },
      outputSummary: { assetId: data.id, duration: generationResult.durationSeconds },
    });

    return data as MediaAssetRow;
  }

  // ============================================================================
  // 4. SUBTITLE STUDIO
  // ============================================================================

  static generateSubtitles(text: string, durationSeconds = 30): SubtitleCue[] {
    return SubtitleGenerator.generateCuesFromText(text, durationSeconds);
  }

  // ============================================================================
  // 5. VIDEO GENERATION
  // ============================================================================

  static async queueVideoGeneration(
    workspaceId: string,
    userId: string,
    request: VideoGenerationRequest
  ): Promise<{ job: GenerationJobRow; asset: MediaAssetRow }> {
    const requiredCredits = AI_OPERATION_CREDIT_COSTS.video_generation;
    await UsageBillingService.assertSufficientCredits(workspaceId, userId, requiredCredits);

    const supabase = await createClient();

    // 1. Create generation_jobs row (queued)
    const { data: jobData, error: jobErr } = await supabase
      .from("generation_jobs")
      .insert({
        workspace_id: workspaceId,
        job_type: "video_generation",
        status: "processing",
        progress_percent: 20,
        provider: "creatoros-video-engine",
        credits_cost: requiredCredits,
        input_payload: request as unknown as Json,
        started_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("*")
      .single();

    if (jobErr) throw new Error(`Gagal membuat job video: ${jobErr.message}`);

    try {
      // 2. Fetch source image if image-to-video mode
      let sourceImageBuffer: Buffer | undefined;
      if (request.sourceImageId) {
        const { data: assetRow } = await supabase
          .from("media_assets")
          .select("id")
          .eq("id", request.sourceImageId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (assetRow) {
          const file = await MediaStorageService.getMediaFile(assetRow.id);
          if (file) sourceImageBuffer = file.buffer;
        }
      }

      // 3. Update progress (60%)
      await supabase
        .from("generation_jobs")
        .update({ progress_percent: 60 })
        .eq("id", jobData.id);

      // 4. Synthesize real video clip
      const clipResult = await VideoSynthesizer.synthesizeClip({
        title: request.prompt,
        durationSeconds: request.durationSeconds,
        aspectRatio: request.aspectRatio,
        motion: request.motion,
        sourceImageBuffer,
      });

      // 5. Persist real video file
      const stored = await MediaStorageService.saveMediaBuffer(
        clipResult.videoBuffer,
        clipResult.mimeType,
        `clip_${request.prompt.slice(0, 20)}`,
        workspaceId
      );

      // 6. Insert media asset
      const { data: assetData, error: assetErr } = await supabase
        .from("media_assets")
        .insert({
          workspace_id: workspaceId,
          content_item_id: request.contentItemId || null,
          storyboard_id: request.storyboardId || null,
          asset_type: "video_clip",
          title: request.prompt.slice(0, 80),
          storage_path: stored.storagePath,
          public_url: stored.publicUrl,
          mime_type: stored.mimeType,
          file_size_bytes: stored.fileSizeBytes,
          duration_seconds: clipResult.durationSeconds,
          dimensions: { width: clipResult.width, height: clipResult.height } as unknown as Json,
          metadata: {
            prompt: request.prompt,
            motion: request.motion,
            aspectRatio: request.aspectRatio,
            generation_job_id: jobData.id,
            sceneNumber: request.sceneNumber || null,
          } as unknown as Json,
          created_by: userId,
        })
        .select("*")
        .single();

      if (assetErr) throw new Error(`Gagal menyimpan aset video: ${assetErr.message}`);

      // 7. Complete job (100%)
      const { data: updatedJob } = await supabase
        .from("generation_jobs")
        .update({
          status: "completed",
          progress_percent: 100,
          output_payload: {
            mediaAssetId: assetData.id,
            publicUrl: stored.publicUrl,
            fileSizeBytes: stored.fileSizeBytes,
            durationSeconds: clipResult.durationSeconds,
          } as unknown as Json,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobData.id)
        .select("*")
        .single();

      // 8. Deduct credits & record usage
      await UsageBillingService.recordExecutionUsage({
        workspaceId,
        userId,
        agentName: "VideoEngineAgent",
        operationType: "video_generation",
        provider: "creatoros-video-engine",
        modelId: "video-v1",
        promptTokens: 250,
        completionTokens: 1000,
        totalTokens: 1250,
        costUsd: 0.05,
        creditsToDeduct: requiredCredits,
        durationMs: 2500,
        status: "success",
        inputSummary: { prompt: request.prompt, motion: request.motion },
        outputSummary: { assetId: assetData.id },
      });

      return {
        job: (updatedJob || jobData) as GenerationJobRow,
        asset: assetData as MediaAssetRow,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: errMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobData.id);

      throw err;
    }
  }

  static async retryGenerationJob(
    workspaceId: string,
    userId: string,
    jobId: string
  ): Promise<GenerationJobRow> {
    const hasEditorAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!hasEditorAccess) throw new Error("Akses ditolak.");

    const supabase = await createClient();
    const { data: job, error } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !job) throw new Error("Job tidak ditemukan.");

    if (job.attempts >= job.max_attempts) {
      throw new Error(`Batas maksimal percobaan (${job.max_attempts}) telah tercapai.`);
    }

    // Reset to queued & increment attempts
    const { data: updated, error: updErr } = await supabase
      .from("generation_jobs")
      .update({
        status: "queued",
        progress_percent: 0,
        error_message: null,
        attempts: job.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select("*")
      .single();

    if (updErr) throw new Error(`Gagal merestart job: ${updErr.message}`);

    // If job was timeline_export, re-dispatch
    if (job.job_type === "timeline_export") {
      MediaWorkerService.processExportJobInBackground(
        job.id,
        workspaceId,
        userId,
        job.input_payload as unknown as VideoExportRequest
      );
    }

    return updated as GenerationJobRow;
  }

  // ============================================================================
  // 6. TIMELINE & EXPORT CENTER
  // ============================================================================

  static async saveVideoProject(
    workspaceId: string,
    userId: string,
    input: {
      title: string;
      timelineData: TimelineProjectData;
      aspectRatio?: string;
      resolution?: string;
      fps?: number;
      storyboardId?: string | null;
      contentItemId?: string | null;
      projectId?: string | null;
    }
  ): Promise<string> {
    const hasEditorAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!hasEditorAccess) throw new Error("Akses ditolak.");

    const supabase = await createClient();

    if (input.projectId) {
      const { data, error } = await supabase
        .from("video_projects")
        .update({
          title: input.title.trim(),
          timeline_data: input.timelineData as unknown as Json,
          aspect_ratio: (input.aspectRatio as "9:16") || "9:16",
          resolution: (input.resolution as VideoResolution) || "1080p",
          fps: input.fps || 30,
          storyboard_id: input.storyboardId || null,
          content_item_id: input.contentItemId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.projectId)
        .eq("workspace_id", workspaceId)
        .select("id")
        .single();

      if (error) throw new Error(`Gagal memperbarui proyek video: ${error.message}`);
      return data.id;
    }

    const { data, error } = await supabase
      .from("video_projects")
      .insert({
        workspace_id: workspaceId,
        title: input.title.trim(),
        timeline_data: input.timelineData as unknown as Json,
        aspect_ratio: (input.aspectRatio as "9:16") || "9:16",
        resolution: (input.resolution as "1080p") || "1080p",
        fps: input.fps || 30,
        storyboard_id: input.storyboardId || null,
        content_item_id: input.contentItemId || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Gagal membuat proyek video: ${error.message}`);
    return data.id;
  }

  static async getVideoProject(
    workspaceId: string,
    userId: string,
    projectId: string
  ): Promise<VideoProjectRow | null> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) throw new Error("Akses ditolak.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("video_projects")
      .select("*")
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error) throw new Error(`Gagal memuat proyek video: ${error.message}`);
    return (data as VideoProjectRow) || null;
  }

  static async queueVideoExport(
    workspaceId: string,
    userId: string,
    request: VideoExportRequest
  ): Promise<GenerationJobRow> {
    const requiredCredits = AI_OPERATION_CREDIT_COSTS.timeline_export;
    await UsageBillingService.assertSufficientCredits(workspaceId, userId, requiredCredits);

    const supabase = await createClient();

    // 1. Insert generation_jobs (queued)
    const { data: job, error } = await supabase
      .from("generation_jobs")
      .insert({
        workspace_id: workspaceId,
        job_type: "timeline_export",
        status: "queued",
        progress_percent: 0,
        provider: "ffmpeg-worker",
        credits_cost: requiredCredits,
        input_payload: request as unknown as Json,
        created_by: userId,
      })
      .select("*")
      .single();

    if (error) throw new Error(`Gagal mendaftarkan antrean export: ${error.message}`);

    // 2. Dispatch worker processing asynchronously (does not block HTTP response)
    MediaWorkerService.processExportJobInBackground(job.id, workspaceId, userId, request);

    // 3. Deduct credits & record usage
    await UsageBillingService.recordExecutionUsage({
      workspaceId,
      userId,
      agentName: "ExportCenterAgent",
      operationType: "timeline_export",
      provider: "ffmpeg-worker",
      modelId: "ffmpeg-stitcher",
      promptTokens: 100,
      completionTokens: 500,
      totalTokens: 600,
      costUsd: 0.04,
      creditsToDeduct: requiredCredits,
      durationMs: 3500,
      status: "success",
      inputSummary: { title: request.title, resolution: request.resolution },
      outputSummary: { jobId: job.id },
    });

    return job as GenerationJobRow;
  }

  // ============================================================================
  // 7. ASSET & JOB LISTINGS
  // ============================================================================

  static async listMediaAssets(
    workspaceId: string,
    userId: string,
    filterType?: MediaAssetType | "all"
  ): Promise<MediaAssetRow[]> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) throw new Error("Akses ditolak.");

    const supabase = await createClient();
    let query = supabase
      .from("media_assets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (filterType && filterType !== "all") {
      query = query.eq("asset_type", filterType);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Gagal memuat aset media: ${error.message}`);
    return (data as MediaAssetRow[]) || [];
  }

  static async listGenerationJobs(
    workspaceId: string,
    userId: string
  ): Promise<GenerationJobRow[]> {
    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) throw new Error("Akses ditolak.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(`Gagal memuat antrean job: ${error.message}`);
    return (data as GenerationJobRow[]) || [];
  }
}
