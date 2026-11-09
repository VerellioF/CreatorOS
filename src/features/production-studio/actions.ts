"use server";

import { revalidatePath } from "next/cache";
import { AuthService } from "@/services/auth-service";
import { ProductionStudioService } from "@/services/production-studio-service";
import {
  storyboardInputSchema,
  imageGenerationRequestSchema,
  voiceGenerationRequestSchema,
  videoGenerationRequestSchema,
  videoExportRequestSchema,
  type StoryboardInput,
  type ImageGenerationRequest,
  type VoiceGenerationRequest,
  type VideoGenerationRequest,
  type VideoExportRequest,
} from "@/lib/validation/production-schemas";
import { createClient } from "@/lib/supabase/server";

export async function saveStoryboardAction(
  workspaceId: string,
  rawInput: StoryboardInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const validated = storyboardInputSchema.parse(rawInput);
  const id = await ProductionStudioService.saveStoryboard(workspaceId, user.id, validated);

  revalidatePath("/studio/storyboard");
  return { success: true, id };
}

export async function generateAiStoryboardAction(
  workspaceId: string,
  params: {
    scriptText: string;
    title: string;
    visualTheme?: string;
    contentItemId?: string;
  }
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  if (!params.scriptText || params.scriptText.trim().length < 5) {
    throw new Error("Naskah minimal 5 karakter untuk dianalisis oleh AI.");
  }

  const result = await ProductionStudioService.generateAiStoryboard(workspaceId, user.id, params);
  return { success: true, data: result };
}

export async function generateImageAction(
  workspaceId: string,
  rawRequest: ImageGenerationRequest
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const validated = imageGenerationRequestSchema.parse(rawRequest);
  const asset = await ProductionStudioService.generateImage(workspaceId, user.id, validated);

  revalidatePath("/studio/images");
  revalidatePath("/studio/storyboard");
  return { success: true, asset };
}

export async function generateVoiceoverAction(
  workspaceId: string,
  rawRequest: VoiceGenerationRequest
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const validated = voiceGenerationRequestSchema.parse(rawRequest);
  const asset = await ProductionStudioService.generateVoiceover(workspaceId, user.id, validated);

  revalidatePath("/studio/voice");
  revalidatePath("/studio/storyboard");
  return { success: true, asset };
}

export async function generateSubtitlesAction(
  workspaceId: string,
  text: string,
  durationSeconds?: number
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  if (!text || text.trim().length === 0) {
    throw new Error("Teks diperlukan untuk menghasilkan subtitle.");
  }

  const cues = ProductionStudioService.generateSubtitles(text, durationSeconds);
  return { success: true, cues };
}

export async function generateVideoClipAction(
  workspaceId: string,
  rawRequest: VideoGenerationRequest
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const validated = videoGenerationRequestSchema.parse(rawRequest);
  const result = await ProductionStudioService.queueVideoGeneration(workspaceId, user.id, validated);

  revalidatePath("/studio/video");
  return { success: true, ...result };
}

export async function retryGenerationJobAction(
  workspaceId: string,
  jobId: string
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const updatedJob = await ProductionStudioService.retryGenerationJob(workspaceId, user.id, jobId);

  revalidatePath("/studio/video");
  revalidatePath("/studio/export");
  return { success: true, job: updatedJob };
}

export async function saveVideoProjectAction(
  workspaceId: string,
  input: {
    title: string;
    timelineData: unknown;
    aspectRatio?: string;
    resolution?: string;
    fps?: number;
    storyboardId?: string | null;
    contentItemId?: string | null;
    projectId?: string | null;
  }
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const id = await ProductionStudioService.saveVideoProject(
    workspaceId,
    user.id,
    input as Parameters<typeof ProductionStudioService.saveVideoProject>[2]
  );

  revalidatePath("/studio/timeline");
  return { success: true, id };
}

export async function queueVideoExportAction(
  workspaceId: string,
  rawRequest: VideoExportRequest
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const validated = videoExportRequestSchema.parse(rawRequest);
  const job = await ProductionStudioService.queueVideoExport(workspaceId, user.id, validated);

  revalidatePath("/studio/export");
  return { success: true, job };
}

export async function getGenerationJobStatusAction(
  workspaceId: string,
  jobId: string
) {
  const user = await AuthService.getCurrentUser();
  if (!user) throw new Error("Autentikasi diperlukan.");

  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !job) {
    throw new Error("Job tidak ditemukan.");
  }

  return { success: true, job };
}
