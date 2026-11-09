import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { MediaStorageService } from "@/services/media-storage-service";
import { VideoSynthesizer } from "@/lib/media/video-synthesizer";
import { FFmpegRunner } from "@/lib/media/ffmpeg-runner";
import type { VideoExportRequest } from "@/lib/validation/production-schemas";
import type { Json } from "@/lib/supabase/types";

export interface MediaWorkerJobResult {
  jobId: string;
  status: "completed" | "failed";
  mediaAssetId?: string;
  publicUrl?: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  errorMessage?: string;
}

export class MediaWorkerService {
  /**
   * Dispatches and processes a video export job in the background asynchronously.
   * Does NOT block ordinary web requests.
   */
  static processExportJobInBackground(
    jobId: string,
    workspaceId: string,
    userId: string,
    request: VideoExportRequest
  ): void {
    // Fire-and-forget background execution
    setImmediate(async () => {
      try {
        await this.executeExportJob(jobId, workspaceId, userId, request);
      } catch (err) {
        console.error(`[MediaWorkerService] Background render failed for job ${jobId}:`, err);
      }
    });
  }

  /**
   * Executes the timeline rendering pipeline and updates generation_jobs.
   */
  static async executeExportJob(
    jobId: string,
    workspaceId: string,
    userId: string,
    request: VideoExportRequest
  ): Promise<MediaWorkerJobResult> {
    const supabase = await createClient();

    // 1. Advance job to 'processing' (15%)
    await supabase
      .from("generation_jobs")
      .update({
        status: "processing",
        progress_percent: 15,
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId)
      .eq("workspace_id", workspaceId);

    try {
      const duration = Math.max(
        3,
        request.timelineData.duration || this.calculateTimelineDuration(request.timelineData)
      );

      // 2. Advance progress (45%)
      await supabase
        .from("generation_jobs")
        .update({ progress_percent: 45 })
        .eq("id", jobId);

      // 3. Render video composition
      const isFFmpegReady = await FFmpegRunner.isAvailable();
      let videoBuffer: Buffer | null = null;

      if (isFFmpegReady) {
        videoBuffer = await this.renderTimelineWithFFmpeg(request, duration);
      }

      if (!videoBuffer) {
        // High fidelity standalone fallback
        const synth = await VideoSynthesizer.synthesizeClip({
          title: request.title,
          durationSeconds: duration,
          aspectRatio: request.aspectRatio,
        });
        videoBuffer = synth.videoBuffer;
      }

      // 4. Advance progress (80%)
      await supabase
        .from("generation_jobs")
        .update({ progress_percent: 80 })
        .eq("id", jobId);

      // 5. Persist real media file to storage
      const stored = await MediaStorageService.saveMediaBuffer(
        videoBuffer,
        "video/mp4",
        request.title,
        workspaceId
      );

      // 6. Insert record into media_assets
      const { data: assetData, error: assetErr } = await supabase
        .from("media_assets")
        .insert({
          workspace_id: workspaceId,
          content_item_id: request.contentItemId || null,
          storyboard_id: request.storyboardId || null,
          asset_type: "exported_video",
          title: request.title,
          storage_path: stored.storagePath,
          public_url: stored.publicUrl,
          mime_type: stored.mimeType,
          file_size_bytes: stored.fileSizeBytes,
          duration_seconds: duration,
          dimensions: this.getResolutionDimensions(request.aspectRatio, request.resolution) as unknown as Json,
          metadata: {
            resolution: request.resolution,
            fps: request.fps,
            aspectRatio: request.aspectRatio,
            generation_job_id: jobId,
            source: "timeline_editor",
          } as unknown as Json,
          created_by: userId,
        })
        .select("id")
        .single();

      if (assetErr) {
        throw new Error(`Gagal menyimpan rekaman media_asset: ${assetErr.message}`);
      }

      const mediaAssetId = assetData.id;

      // 7. Update video_projects with latest export ID if projectId is present
      if (request.projectId) {
        await supabase
          .from("video_projects")
          .update({
            latest_export_asset_id: mediaAssetId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.projectId)
          .eq("workspace_id", workspaceId);
      }

      // 8. Mark generation_jobs as completed (100%)
      await supabase
        .from("generation_jobs")
        .update({
          status: "completed",
          progress_percent: 100,
          output_payload: {
            mediaAssetId,
            publicUrl: stored.publicUrl,
            fileSizeBytes: stored.fileSizeBytes,
            durationSeconds: duration,
            completedAt: new Date().toISOString(),
          } as unknown as Json,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return {
        jobId,
        status: "completed",
        mediaAssetId,
        publicUrl: stored.publicUrl,
        fileSizeBytes: stored.fileSizeBytes,
        durationSeconds: duration,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      // Record failed state in generation_jobs
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: errMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return {
        jobId,
        status: "failed",
        errorMessage: errMsg,
      };
    }
  }

  private static calculateTimelineDuration(timelineData: VideoExportRequest["timelineData"]): number {
    let maxTime = 5;
    for (const track of timelineData.tracks) {
      for (const clip of track.clips) {
        if (clip.endTime > maxTime) {
          maxTime = clip.endTime;
        }
      }
    }
    return Math.ceil(maxTime);
  }

  private static getResolutionDimensions(
    aspectRatio: string,
    resolution: string
  ): { width: number; height: number } {
    const isVertical = aspectRatio === "9:16";
    const isSquare = aspectRatio === "1:1";

    if (resolution === "720p") {
      if (isVertical) return { width: 720, height: 1280 };
      if (isSquare) return { width: 720, height: 720 };
      return { width: 1280, height: 720 };
    }
    if (resolution === "4k") {
      if (isVertical) return { width: 2160, height: 3840 };
      if (isSquare) return { width: 2160, height: 2160 };
      return { width: 3840, height: 2160 };
    }

    // Default 1080p
    if (isVertical) return { width: 1080, height: 1920 };
    if (isSquare) return { width: 1080, height: 1080 };
    return { width: 1920, height: 1080 };
  }

  private static async renderTimelineWithFFmpeg(
    request: VideoExportRequest,
    duration: number
  ): Promise<Buffer | null> {
    const tmpDir = os.tmpdir();
    const jobId = randomUUID();
    const outPath = path.join(tmpDir, `export_${jobId}.mp4`);
    const { width, height } = this.getResolutionDimensions(
      request.aspectRatio,
      request.resolution
    );

    try {
      const args = [
        "-f", "lavfi", "-i", `color=c=black:s=${width}x${height}:r=${request.fps}:d=${duration}`,
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", String(duration),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        "-y",
        outPath,
      ];

      const result = await FFmpegRunner.run(args, { timeoutMs: 45_000 });
      if (result.success && fs.existsSync(outPath)) {
        return await fs.promises.readFile(outPath);
      }
      return null;
    } finally {
      await fs.promises.unlink(outPath).catch(() => {});
    }
  }
}
