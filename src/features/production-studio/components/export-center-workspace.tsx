"use client";

import * as React from "react";
import Link from "next/link";
import {
  Download,
  Play,
  RotateCcw,
  Film,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HardDrive,
  Copy,
  Sliders,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  retryGenerationJobAction,
  queueVideoExportAction,
} from "@/features/production-studio/actions";
import type { GenerationJobRow, MediaAssetRow } from "@/lib/supabase/types";

interface ExportCenterWorkspaceProps {
  workspaceId: string;
  initialJobs: GenerationJobRow[];
  exportedVideos: MediaAssetRow[];
  canEdit: boolean;
  creditBalance: number;
}

export function ExportCenterWorkspace({
  workspaceId,
  initialJobs,
  exportedVideos,
  canEdit,
  creditBalance,
}: ExportCenterWorkspaceProps) {
  const [jobs, setJobs] = React.useState<GenerationJobRow[]>(initialJobs);
  const [videos, setVideos] = React.useState<MediaAssetRow[]>(exportedVideos);
  const [title, setTitle] = React.useState("Video Siap Publikasi");
  const [aspectRatio, setAspectRatio] = React.useState<"9:16" | "16:9" | "1:1">("9:16");
  const [resolution, setResolution] = React.useState<"1080p" | "720p" | "4k">("1080p");
  const [fps, setFps] = React.useState<24 | 30 | 60>(30);
  const [isExporting, setIsExporting] = React.useState(false);

  // Poll for active processing jobs every 3 seconds while any job is active
  React.useEffect(() => {
    const hasActiveJobs = jobs.some((j) => j.status === "queued" || j.status === "processing");
    if (!hasActiveJobs) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/workspace/jobs?wsId=${workspaceId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.jobs)) {
            setJobs(data.jobs);
          }
        }
      } catch {
        // Soft fallback
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs, workspaceId]);

  const handleStartExport = async () => {
    setIsExporting(true);
    try {
      const res = await queueVideoExportAction(workspaceId, {
        title,
        aspectRatio,
        resolution,
        fps,
        timelineData: {
          tracks: [
            {
              id: "track-v1",
              type: "video",
              name: "Visuals",
              muted: false,
              locked: false,
              clips: [
                {
                  id: "clip-1",
                  trackId: "track-v1",
                  title: "Video Master",
                  assetType: "video",
                  startTime: 0,
                  endTime: 10,
                  trimStart: 0,
                  trimEnd: 10,
                  volume: 1,
                },
              ],
            },
          ],
          duration: 10,
        },
      });

      if (res.success && res.job) {
        setJobs((prev) => [res.job, ...prev]);
        toast.success("Job rendering dikirim ke background worker!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memulai export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const res = await retryGenerationJobAction(workspaceId, jobId);
      if (res.success && res.job) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? res.job : j)));
        toast.success("Job export dimulai ulang!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengulang job.");
    }
  };

  const handleCopyLink = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success("Tautan video disalin ke clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Export Center</h2>
              <Badge variant="outline" className="text-xs">
                {videos.length} Video Siap Unduh
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Rendering latar belakang menggunakan FFmpeg worker. File video MP4 valid dan siap dipublikasikan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Kredit: 4 per export (Tersedia: {creditBalance})
          </Badge>
          <Link href="/studio/timeline">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Film className="h-4 w-4" />
              Buka Timeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Render Configuration Card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Konfigurasi Output Render
          </CardTitle>
          <CardDescription className="text-xs">
            Tentukan format resolusi, rasio platform, dan framerate video target.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Rasio Aspek Platform:
              </label>
              <select
                aria-label="Rasio Aspek Platform"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="9:16">9:16 (Vertikal - TikTok, Reels, Shorts)</option>
                <option value="16:9">16:9 (Horizontal - YouTube)</option>
                <option value="1:1">1:1 (Persegi - Feed Instagram)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Resolusi Video:
              </label>
              <select
                aria-label="Resolusi Video"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as "1080p" | "720p" | "4k")}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="1080p">1080p Full HD (Direkomendasikan)</option>
                <option value="720p">720p HD (Ukuran Ringan)</option>
                <option value="4k">4K Ultra HD (Kualitas Tertinggi)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Framerate (FPS):
              </label>
              <select
                aria-label="Framerate (FPS)"
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value, 10) as 24 | 30 | 60)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value={30}>30 FPS (Standar Media Sosial)</option>
                <option value={60}>60 FPS (Ultra Smooth Motion)</option>
                <option value={24}>24 FPS (Cinematic Look)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={handleStartExport}
              disabled={isExporting || !canEdit}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {isExporting ? "Mengirim ke Worker..." : "Mulai Render Video"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Background Rendering Jobs Queue */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Antrean Render Background Worker
            <Badge variant="outline" className="text-xs">
              {jobs.length}
            </Badge>
          </h3>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl bg-card/40">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium text-foreground">Tidak ada antrean render aktif</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const input = (job.input_payload as Record<string, unknown>) || {};
              const jobTitle = (input.title as string) || "Export Video";
              const output = (job.output_payload as Record<string, unknown>) || {};
              const downloadUrl = output.publicUrl as string | undefined;

              return (
                <Card key={job.id} className="border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
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
                          {job.status}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          ID: {job.id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Percobaan: {job.attempts}/{job.max_attempts}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground">{jobTitle}</p>

                      <div className="w-full max-w-sm bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all duration-300"
                          style={{ width: `${job.progress_percent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Progress: {job.progress_percent}%
                      </span>

                      {job.error_message && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {job.error_message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {job.status === "completed" && downloadUrl && (
                        <a href={downloadUrl} download={`video_${job.id}.mp4`}>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                            <Download className="h-3.5 w-3.5" />
                            Unduh MP4
                          </Button>
                        </a>
                      )}

                      {job.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(job.id)}
                          className="gap-1.5 text-xs h-8"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Retry
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

      {/* Completed Video Deliverables Gallery */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            File Video Hasil Render (Media Files)
            <Badge variant="outline" className="text-xs">
              {videos.length}
            </Badge>
          </h3>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-xl bg-card/40">
            <HardDrive className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-foreground">Belum ada video yang diekspor</p>
            <p className="text-xs text-muted-foreground mt-1">
              Render video dari Timeline Editor atau tombol render di atas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {videos.map((vid) => {
              const meta = (vid.metadata as Record<string, unknown>) || {};
              const resTag = (meta.resolution as string) || "1080p";
              const aspectTag = (meta.aspectRatio as string) || "9:16";
              const sizeMb = (vid.file_size_bytes / (1024 * 1024)).toFixed(2);

              return (
                <Card
                  key={vid.id}
                  className="border-border bg-card overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div className="p-3 bg-black flex items-center justify-center">
                    {/* Real Playable HTML5 Video */}
                    <video
                      controls
                      src={vid.public_url}
                      className="max-h-48 rounded bg-black object-contain w-full"
                      preload="none"
                    />
                  </div>

                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {resTag}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {aspectTag}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {sizeMb} MB
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-foreground line-clamp-1" title={vid.title}>
                      {vid.title}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <a
                        href={vid.public_url}
                        download={`video_${vid.id}.mp4`}
                        className="flex-1"
                      >
                        <Button size="sm" variant="outline" className="w-full gap-1 text-xs h-7">
                          <Download className="h-3 w-3" />
                          Unduh
                        </Button>
                      </a>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyLink(vid.public_url)}
                        className="gap-1 text-xs h-7"
                        title="Salin Tautan Video"
                      >
                        <Copy className="h-3 w-3" />
                        Salin
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
