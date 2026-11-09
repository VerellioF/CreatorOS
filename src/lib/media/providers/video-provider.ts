import { VideoSynthesizer } from "@/lib/media/video-synthesizer";
import type { VideoGenerationRequest } from "@/lib/validation/production-schemas";

export interface VideoGenerationJobProgress {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progressPercent: number;
  videoBuffer?: Buffer;
  mimeType?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  errorMessage?: string;
  provider: string;
}

export interface VideoGenerationProvider {
  readonly id: string;
  generateVideoClip(
    request: VideoGenerationRequest,
    sourceImageBuffer?: Buffer
  ): Promise<{
    videoBuffer: Buffer;
    mimeType: string;
    durationSeconds: number;
    width: number;
    height: number;
    provider: string;
  }>;
}

export class DefaultVideoProvider implements VideoGenerationProvider {
  readonly id = "creatoros-video-engine";

  async generateVideoClip(
    request: VideoGenerationRequest,
    sourceImageBuffer?: Buffer
  ): Promise<{
    videoBuffer: Buffer;
    mimeType: string;
    durationSeconds: number;
    width: number;
    height: number;
    provider: string;
  }> {
    const synthResult = await VideoSynthesizer.synthesizeClip({
      title: request.prompt.slice(0, 80),
      durationSeconds: request.durationSeconds,
      aspectRatio: request.aspectRatio,
      motion: request.motion,
      sourceImageBuffer,
    });

    return {
      ...synthResult,
      provider: this.id,
    };
  }
}

export class VideoProviderRegistry {
  static getProvider(): VideoGenerationProvider {
    return new DefaultVideoProvider();
  }
}
