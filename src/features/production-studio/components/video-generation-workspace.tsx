"use client";

import * as React from "react";
import Link from "next/link";
import {
  Video,
  Play,
  RotateCcw,
  Sparkles,
  Download,
  Film,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  generateVideoClipAction,
  retryGenerationJobAction,
} from "@/features/production-studio/actions";
import type { GenerationJobRow, MediaAssetRow } from "@/lib/supabase/types";
import type {
  VideoGenerationMode,
  VideoMotionPreset,
} from "@/lib/validation/production-schemas";

interface VideoGenerationWorkspaceProps {
  workspaceId: string;
  initialJobs: GenerationJobRow[];
  availableImages: MediaAssetRow[];
  prefilledPrompt?: string;
  prefilledScene?: number;
  canEdit: boolean;
  creditBalance: number;
}

export function VideoGenerationWorkspace({
  workspaceId,
  initialJobs,
  availableImages,
  prefilledPrompt = "",
  prefilledScene,
  canEdit,
  creditBalance,
}: VideoGenerationWorkspaceProps) {
  const [jobs, setJobs] = React.useState<GenerationJobRow[]>(initialJobs);
  const [mode, setMode] = React.useState<VideoGenerationMode>("text_to_video");
  const [prompt, setPrompt] = React.useState(
    prefilledPrompt ||
      "Cinematic slow pan seorang kreator profesional di studio pencahayaan neon, suasana futuristik dan elegan"
  );
  const [aspectRatio, setAspectRatio] = React.useState<"9:16" | "16:9" | "1:1">("9:16");
  const [durationSeconds, setDurationSeconds] = React.useState<5 | 10>(5);
  const [motion, setMotion] = React.useState<VideoMotionPreset>("cinematic_slow_pan");
  const [sourceImageId, setSourceImageId] = React.useState<string>("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      toast.error("Prompt video minimal 3 karakter.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateVideoClipAction(workspaceId, {
        mode,
        prompt,
        aspectRatio,
        durationSeconds,
        motion,
        sourceImageId: sourceImageId || undefined,
        sceneNumber: prefilledScene,
      });

      if (res.success && res.job) {
        setJobs((prev) => [res.job, ...prev]);
        toast.success("Klip video berhasil dibuat dan tersimpan!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat klip video.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const res = await retryGenerationJobAction(workspaceId, jobId);
      if (res.success && res.job) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? res.job : j)));
        toast.success("Job berhasil dimulai ulang!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengulang job.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Video Generation Studio</h2>
              <Badge variant="outline" className="text-xs">
                {jobs.length} Antrean Job
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Pembuatan video klip sintetis (Text-to-Video, Image-to-Video, Scene Generation) dengan pelacakan status dan retry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Kredit: 5 per klip (Tersedia: {creditBalance})
          </Badge>
          <Link href="/studio/timeline">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Film className="h-4 w-4" />
              Buka Timeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Generator Form */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Konfigurasi Video AI
          </CardTitle>
          <CardDescription className="text-xs">
            Pilih mode pembuatan (Text-to-Video atau Image-to-Video), rasio aspek, durasi klip, dan gerakan kamera.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Mode Pembuatan Video:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: "text_to_video", label: "Text-to-Video", desc: "Dari deskripsi teks bebas" },
                { id: "image_to_video", label: "Image-to-Video", desc: "Animasi dari aset gambar" },
                { id: "scene_to_video", label: "Scene Generation", desc: "Dari storyboard scene" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as VideoGenerationMode)}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                    mode === m.id
                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="text-xs font-semibold text-foreground">{m.label}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Image-to-Video Source Image Selector */}
          {mode === "image_to_video" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Pilih Gambar Sumber (Image Source):
              </label>
              {availableImages.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Belum ada gambar di galeri. Buat gambar terlebih dahulu di Image Studio.
                </p>
              ) : (
                <select
                  aria-label="Pilih Gambar Sumber"
                  value={sourceImageId}
                  onChange={(e) => setSourceImageId(e.target.value)}
                  className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">-- Pilih gambar dari galeri Image Studio --</option>
                  {availableImages.map((img) => (
                    <option key={img.id} value={img.id}>
                      {img.title} ({img.asset_type})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Aspect Ratio, Duration & Motion */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Rasio Aspek:
              </label>
              <select
                aria-label="Rasio Aspek"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="9:16">9:16 (Vertikal - TikTok, Reels, Shorts)</option>
                <option value="16:9">16:9 (Horizontal - YouTube)</option>
                <option value="1:1">1:1 (Persegi - Instagram Feed)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Durasi Klip:
              </label>
              <select
                aria-label="Durasi Klip"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10) as 5 | 10)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value={5}>5 Detik</option>
                <option value={10}>10 Detik</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Preset Gerakan Kamera (Motion):
              </label>
              <select
                aria-label="Preset Gerakan Kamera"
                value={motion}
                onChange={(e) => setMotion(e.target.value as VideoMotionPreset)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="cinematic_slow_pan">Cinematic Slow Pan (Geser perlahan)</option>
                <option value="dynamic_zoom">Dynamic Zoom In (Mendekat halus)</option>
                <option value="orbit">Orbit (Memutar mengelilingi subjek)</option>
                <option value="tilt_up">Tilt Up (Dari bawah ke atas)</option>
                <option value="static">Static (Stabil tanpa gerakan)</option>
              </select>
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Prompt Deskripsi Video:
            </label>
            <Textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsikan pergerakan visual, subjek, tata cahaya..."
              className="text-xs"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !canEdit || prompt.trim().length < 3}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Merender Video Klip..." : "Hasilkan Klip Video"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generation Jobs Queue & Preview Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Status Antrean Job Video
            <Badge variant="outline" className="text-xs">
              {jobs.length}
            </Badge>
          </h3>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-card/40">
            <Video className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-foreground">Belum ada job video</p>
            <p className="text-xs text-muted-foreground mt-1">
              Buat klip video pertama Anda menggunakan formulir di atas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const input = (job.input_payload as Record<string, unknown>) || {};
              const output = (job.output_payload as Record<string, unknown>) || {};
              const jobPrompt = (input.prompt as string) || "Video Clip";
              const publicUrl = output.publicUrl as string | undefined;

              return (
                <Card
                  key={job.id}
                  className="border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "default"
                              : job.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="text-[10px] capitalize font-semibold"
                        >
                          {job.status === "processing" ? "Sedang Diproses" : job.status}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          ID: {job.id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          Percobaan: {job.attempts}/{job.max_attempts}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-foreground line-clamp-2">
                        {jobPrompt}
                      </p>

                      {/* Progress bar */}
                      <div className="w-full max-w-md bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            job.status === "completed"
                              ? "bg-primary"
                              : job.status === "failed"
                                ? "bg-destructive"
                                : "bg-primary/80 animate-pulse"
                          }`}
                          style={{ width: `${job.progress_percent}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Progress: {job.progress_percent}%
                      </span>

                      {job.error_message && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {job.error_message}
                        </p>
                      )}
                    </div>

                    {/* Preview / Action Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {job.status === "completed" && publicUrl && (
                        <div className="flex items-center gap-3">
                          {/* Real Video Player */}
                          <video
                            controls
                            src={publicUrl}
                            className="h-24 w-36 rounded-lg bg-black object-contain shadow-sm"
                            preload="none"
                          />

                          <div className="flex flex-col gap-1.5">
                            <a
                              href={publicUrl}
                              download={`video_${job.id}.mp4`}
                            >
                              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs w-full">
                                <Download className="h-3.5 w-3.5" />
                                Unduh MP4
                              </Button>
                            </a>

                            <Link href="/studio/timeline">
                              <Button size="sm" variant="secondary" className="h-8 gap-1.5 text-xs w-full">
                                <Film className="h-3.5 w-3.5" />
                                Ke Timeline
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}

                      {job.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(job.id)}
                          className="gap-1.5 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Ulangi Job (Retry)
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
