import { z } from "zod";

// ==============================================================================
// 1. STORYBOARD STUDIO SCHEMAS
// ==============================================================================

export const SHOT_TYPES = [
  "close_up",
  "medium",
  "wide",
  "over_shoulder",
  "aerial",
  "pov",
] as const;
export type ShotType = (typeof SHOT_TYPES)[number];

export const TRANSITION_TYPES = [
  "cut",
  "fade",
  "dissolve",
  "wipe",
  "zoom_in",
] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const storyboardSceneSchema = z.object({
  sceneNumber: z.number().int().min(1).max(50),
  durationSeconds: z.number().int().min(1).max(120).default(5),
  shotType: z.enum(SHOT_TYPES).default("medium"),
  shotDescription: z.string().trim().min(3).max(500),
  visualDirection: z.string().trim().min(3).max(500),
  voiceoverText: z.string().trim().min(0).max(1000).default(""),
  subtitleText: z.string().trim().min(0).max(500).default(""),
  transitionSuggestion: z.enum(TRANSITION_TYPES).default("cut"),
  imageAssetId: z.string().uuid().optional().nullable(),
  videoAssetId: z.string().uuid().optional().nullable(),
  audioAssetId: z.string().uuid().optional().nullable(),
});
export type StoryboardScene = z.infer<typeof storyboardSceneSchema>;

export const storyboardInputSchema = z.object({
  storyboardId: z.string().uuid().optional().nullable(),
  contentItemId: z.string().uuid().optional().nullable(),
  title: z
    .string()
    .trim()
    .min(2, "Judul storyboard minimal 2 karakter")
    .max(220, "Judul storyboard maksimal 220 karakter"),
  visualTheme: z.string().trim().min(2).max(100).default("cinematic"),
  scenes: z
    .array(storyboardSceneSchema)
    .min(1, "Storyboard minimal harus memiliki 1 scene")
    .max(50, "Maksimal 50 scene per storyboard"),
});
export type StoryboardInput = z.infer<typeof storyboardInputSchema>;

export const aiStoryboardBreakdownOutputSchema = z.object({
  title: z.string().trim().min(2).max(220),
  visualTheme: z.string().trim().min(2).max(100),
  overviewConcept: z.string().trim().min(10).max(1000),
  scenes: z.array(storyboardSceneSchema).min(1).max(30),
});
export type AiStoryboardBreakdownOutput = z.infer<
  typeof aiStoryboardBreakdownOutputSchema
>;

// ==============================================================================
// 2. IMAGE STUDIO SCHEMAS
// ==============================================================================

export const IMAGE_MODES = [
  "thumbnail",
  "scene_visual",
  "brand_visual",
  "variation",
] as const;
export type ImageGenerationMode = (typeof IMAGE_MODES)[number];

export const IMAGE_ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:5"] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

export const IMAGE_STYLE_PRESETS = [
  "photorealistic",
  "cinematic",
  "3d_render",
  "minimalist",
  "cyberpunk",
  "vibrant_creator",
] as const;
export type ImageStylePreset = (typeof IMAGE_STYLE_PRESETS)[number];

export const imageGenerationRequestSchema = z.object({
  mode: z.enum(IMAGE_MODES).default("thumbnail"),
  prompt: z
    .string()
    .trim()
    .min(3, "Prompt gambar minimal 3 karakter")
    .max(1200, "Prompt gambar maksimal 1200 karakter"),
  aspectRatio: z.enum(IMAGE_ASPECT_RATIOS).default("9:16"),
  style: z.enum(IMAGE_STYLE_PRESETS).default("cinematic"),
  negativePrompt: z.string().trim().max(500).optional(),
  sceneNumber: z.number().int().min(1).max(50).optional(),
  storyboardId: z.string().uuid().optional().nullable(),
  contentItemId: z.string().uuid().optional().nullable(),
  sourceAssetId: z.string().uuid().optional().nullable(),
});
export type ImageGenerationRequest = z.infer<typeof imageGenerationRequestSchema>;

// ==============================================================================
// 3. VOICE STUDIO SCHEMAS
// ==============================================================================

export const VOICE_LANGUAGES = ["id", "en"] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];

export const VOICE_PERSONAS = [
  { id: "budi_energetic", name: "Budi (Enerjik & Cepat)", lang: "id", gender: "male" },
  { id: "siti_warm", name: "Siti (Hangat & Ramah)", lang: "id", gender: "female" },
  { id: "arya_authoritative", name: "Arya (Otoritatif & Berwibawa)", lang: "id", gender: "male" },
  { id: "putri_storyteller", name: "Putri (Storyteller Ekspresif)", lang: "id", gender: "female" },
  { id: "rian_casual", name: "Rian (Kasual Teman Ngobrol)", lang: "id", gender: "male" },
  { id: "clara_executive", name: "Clara (Professional Executive)", lang: "en", gender: "female" },
  { id: "david_narrator", name: "David (Deep Cinematic Narrator)", lang: "en", gender: "male" },
] as const;

export const VOICE_PERSONA_IDS = [
  "budi_energetic",
  "siti_warm",
  "arya_authoritative",
  "putri_storyteller",
  "rian_casual",
  "clara_executive",
  "david_narrator",
] as const;
export type VoicePersonaId = (typeof VOICE_PERSONA_IDS)[number];

export const voiceGenerationRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, "Naskah voiceover minimal 3 karakter")
    .max(5000, "Naskah voiceover maksimal 5000 karakter"),
  language: z.enum(VOICE_LANGUAGES).default("id"),
  personaId: z.enum(VOICE_PERSONA_IDS).default("budi_energetic"),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(0.5).max(1.5).default(1.0),
  sceneNumber: z.number().int().min(1).max(50).optional(),
  storyboardId: z.string().uuid().optional().nullable(),
  contentItemId: z.string().uuid().optional().nullable(),
});
export type VoiceGenerationRequest = z.infer<typeof voiceGenerationRequestSchema>;

// ==============================================================================
// 4. SUBTITLE STUDIO SCHEMAS
// ==============================================================================

export const subtitleCueSchema = z.object({
  id: z.string().min(1),
  startTimeSeconds: z.number().min(0),
  endTimeSeconds: z.number().min(0.1),
  text: z.string().trim().min(1).max(200),
});
export type SubtitleCue = z.infer<typeof subtitleCueSchema>;

export const SUBTITLE_FONTS = [
  "inter",
  "montserrat",
  "poppins",
  "bebas_neue",
] as const;
export type SubtitleFont = (typeof SUBTITLE_FONTS)[number];

export const SUBTITLE_POSITIONS = ["bottom", "middle", "top"] as const;
export type SubtitlePosition = (typeof SUBTITLE_POSITIONS)[number];

export const subtitleStylingSchema = z.object({
  fontFamily: z.enum(SUBTITLE_FONTS).default("montserrat"),
  fontSize: z.number().int().min(14).max(72).default(28),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
  highlightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FACC15"),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.enum(SUBTITLE_POSITIONS).default("bottom"),
  uppercase: z.boolean().default(true),
});
export type SubtitleStyling = z.infer<typeof subtitleStylingSchema>;

export const subtitleTrackSchema = z.object({
  cues: z.array(subtitleCueSchema).min(1),
  styling: subtitleStylingSchema.default({}),
});
export type SubtitleTrack = z.infer<typeof subtitleTrackSchema>;

// ==============================================================================
// 5. VIDEO GENERATION SCHEMAS
// ==============================================================================

export const VIDEO_MODES = [
  "text_to_video",
  "image_to_video",
  "scene_to_video",
] as const;
export type VideoGenerationMode = (typeof VIDEO_MODES)[number];

export const VIDEO_MOTION_PRESETS = [
  "cinematic_slow_pan",
  "dynamic_zoom",
  "orbit",
  "tilt_up",
  "static",
] as const;
export type VideoMotionPreset = (typeof VIDEO_MOTION_PRESETS)[number];

export const videoGenerationRequestSchema = z.object({
  mode: z.enum(VIDEO_MODES).default("text_to_video"),
  prompt: z
    .string()
    .trim()
    .min(3, "Prompt video minimal 3 karakter")
    .max(1000, "Prompt video maksimal 1000 karakter"),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  durationSeconds: z.union([z.literal(5), z.literal(10)]).default(5),
  motion: z.enum(VIDEO_MOTION_PRESETS).default("cinematic_slow_pan"),
  sourceImageId: z.string().uuid().optional().nullable(),
  storyboardId: z.string().uuid().optional().nullable(),
  sceneNumber: z.number().int().min(1).max(50).optional(),
  contentItemId: z.string().uuid().optional().nullable(),
});
export type VideoGenerationRequest = z.infer<typeof videoGenerationRequestSchema>;

// ==============================================================================
// 6. TIMELINE EDITOR & EXPORT SCHEMAS
// ==============================================================================

export const TRACK_TYPES = ["video", "audio", "subtitle", "overlay"] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

export const timelineClipSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  title: z.string().min(1),
  assetId: z.string().uuid().optional().nullable(),
  assetType: z
    .enum(["image", "video", "audio", "subtitle", "text_overlay"])
    .default("image"),
  mediaUrl: z.string().optional(),
  startTime: z.number().min(0),
  endTime: z.number().min(0.1),
  trimStart: z.number().min(0).default(0),
  trimEnd: z.number().min(0.1).default(5),
  volume: z.number().min(0).max(1).default(1),
  textOverlay: z
    .object({
      text: z.string(),
      fontSize: z.number().int().min(12).max(120).default(36),
      color: z.string().default("#FFFFFF"),
      position: z.enum(["top", "middle", "bottom"]).default("middle"),
    })
    .optional(),
});
export type TimelineClip = z.infer<typeof timelineClipSchema>;

export const timelineTrackSchema = z.object({
  id: z.string().min(1),
  type: z.enum(TRACK_TYPES),
  name: z.string().min(1),
  muted: z.boolean().default(false),
  locked: z.boolean().default(false),
  clips: z.array(timelineClipSchema).default([]),
});
export type TimelineTrack = z.infer<typeof timelineTrackSchema>;

export const timelineProjectDataSchema = z.object({
  tracks: z.array(timelineTrackSchema).default([]),
  duration: z.number().min(0).default(0),
});
export type TimelineProjectData = z.infer<typeof timelineProjectDataSchema>;

export const videoExportRequestSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  storyboardId: z.string().uuid().optional().nullable(),
  contentItemId: z.string().uuid().optional().nullable(),
  title: z
    .string()
    .trim()
    .min(2, "Judul video minimal 2 karakter")
    .max(220, "Judul video maksimal 220 karakter"),
  aspectRatio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  resolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]).default(30),
  timelineData: timelineProjectDataSchema,
});
export type VideoExportRequest = z.infer<typeof videoExportRequestSchema>;
