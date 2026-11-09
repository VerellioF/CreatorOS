import { describe, it, expect } from "vitest";
import {
  storyboardSceneSchema,
  storyboardInputSchema,
  aiStoryboardBreakdownOutputSchema,
  imageGenerationRequestSchema,
  voiceGenerationRequestSchema,
  subtitleCueSchema,
  subtitleStylingSchema,
  videoGenerationRequestSchema,
  timelineClipSchema,
  timelineTrackSchema,
  videoExportRequestSchema,
} from "@/lib/validation/production-schemas";
import { SubtitleGenerator } from "@/lib/media/subtitle-generator";
import { AI_OPERATION_CREDIT_COSTS } from "@/lib/ai/token-budget";

describe("Phase 4 Unit Tests — Production Schemas & Validation", () => {
  it("validates storyboard scene breakdown schema", () => {
    const validScene = storyboardSceneSchema.safeParse({
      sceneNumber: 1,
      durationSeconds: 5,
      shotType: "close_up",
      shotDescription: "Kreator tersenyum di depan ring light",
      visualDirection: "Camera push-in perlahan",
      voiceoverText: "Pernah merasa konten kamu sepi audiens?",
      subtitleText: "Konten sepi audiens?",
      transitionSuggestion: "cut",
    });
    expect(validScene.success).toBe(true);

    const invalidScene = storyboardSceneSchema.safeParse({
      sceneNumber: 0, // must be >= 1
      durationSeconds: 5,
      shotType: "invalid_shot",
      shotDescription: "x", // too short
      visualDirection: "y",
    });
    expect(invalidScene.success).toBe(false);
  });

  it("validates storyboard input container with minimum 1 scene", () => {
    const valid = storyboardInputSchema.safeParse({
      title: "3 Tips Bikin Hook Viral",
      visualTheme: "cinematic",
      scenes: [
        {
          sceneNumber: 1,
          durationSeconds: 5,
          shotType: "medium",
          shotDescription: "Opening scene",
          visualDirection: "Static camera",
          voiceoverText: "Halo semuanya!",
          subtitleText: "Halo semuanya!",
          transitionSuggestion: "cut",
        },
      ],
    });
    expect(valid.success).toBe(true);

    const emptyScenes = storyboardInputSchema.safeParse({
      title: "Storyboard Kosong",
      scenes: [],
    });
    expect(emptyScenes.success).toBe(false);
  });

  it("validates image generation request parameters and modes", () => {
    const validThumbnail = imageGenerationRequestSchema.safeParse({
      mode: "thumbnail",
      prompt: "Seorang kreator muda dengan ekspresi terkejut melihat laptop",
      aspectRatio: "9:16",
      style: "cinematic",
    });
    expect(validThumbnail.success).toBe(true);

    const invalidAspect = imageGenerationRequestSchema.safeParse({
      mode: "thumbnail",
      prompt: "Tes",
      aspectRatio: "21:9", // unsupported aspect ratio
    });
    expect(invalidAspect.success).toBe(false);
  });

  it("validates voice generation request with supported personas and languages", () => {
    const validVoice = voiceGenerationRequestSchema.safeParse({
      text: "Selamat datang di CreatorOS AI, platform produksi konten modern.",
      language: "id",
      personaId: "budi_energetic",
      speed: 1.1,
      pitch: 1.0,
    });
    expect(validVoice.success).toBe(true);

    const invalidSpeed = voiceGenerationRequestSchema.safeParse({
      text: "Tes",
      language: "id",
      personaId: "budi_energetic",
      speed: 3.5, // max is 2.0
    });
    expect(invalidSpeed.success).toBe(false);
  });

  it("validates video generation request parameters and motions", () => {
    const validVideo = videoGenerationRequestSchema.safeParse({
      mode: "text_to_video",
      prompt: "Cinematic drone view kota Jakarta di malam hari dengan gedung bercahaya",
      aspectRatio: "16:9",
      durationSeconds: 5,
      motion: "cinematic_slow_pan",
    });
    expect(validVideo.success).toBe(true);

    const invalidDuration = videoGenerationRequestSchema.safeParse({
      prompt: "Tes",
      durationSeconds: 15, // only 5 or 10 allowed
    });
    expect(invalidDuration.success).toBe(false);
  });

  it("validates subtitle cues, auto-segmentation, and SRT/VTT export formatting", () => {
    const text =
      "Pernah merasa konten kamu sepi audiens padahal udah riset mati-matian? Masalahnya bukan di algoritma, tapi di hook!";
    const cues = SubtitleGenerator.generateCuesFromText(text, 10);

    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues[0].startTimeSeconds).toBe(0);
    expect(cues[0].endTimeSeconds).toBeGreaterThan(0);

    const srt = SubtitleGenerator.exportToSrt(cues);
    expect(srt).toContain("-->");
    expect(srt).toContain("1\n00:00:00,000 -->");

    const vtt = SubtitleGenerator.exportToVtt(cues);
    expect(vtt).toContain("WEBVTT");
    expect(vtt).toContain("-->");

    const json = SubtitleGenerator.exportToJson(cues);
    const parsed = JSON.parse(json);
    expect(parsed.cues.length).toBe(cues.length);
  });

  it("verifies operational credit cost table includes all Phase 4 actions", () => {
    expect(AI_OPERATION_CREDIT_COSTS.storyboard_generation).toBe(3);
    expect(AI_OPERATION_CREDIT_COSTS.image_generation).toBe(2);
    expect(AI_OPERATION_CREDIT_COSTS.voice_generation).toBe(2);
    expect(AI_OPERATION_CREDIT_COSTS.video_generation).toBe(5);
    expect(AI_OPERATION_CREDIT_COSTS.timeline_export).toBe(4);
    expect(AI_OPERATION_CREDIT_COSTS.subtitle_generation).toBe(1);
  });
});
