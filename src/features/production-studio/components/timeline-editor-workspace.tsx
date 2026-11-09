"use client";

import * as React from "react";
import Link from "next/link";
import {
  Film,
  Play,
  Pause,
  RotateCcw,
  Scissors,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  Type,
  Download,
  Save,
  Clock,
  Layers,
  ChevronRight,
  Sliders,
  Image as ImageIcon,
  Video,
  Mic,
  Captions,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  saveVideoProjectAction,
  queueVideoExportAction,
} from "@/features/production-studio/actions";
import type { MediaAssetRow, VideoProjectRow } from "@/lib/supabase/types";
import type {
  TimelineProjectData,
  TimelineTrack,
  TimelineClip,
  TrackType,
} from "@/lib/validation/production-schemas";

interface TimelineEditorWorkspaceProps {
  workspaceId: string;
  mediaAssets: MediaAssetRow[];
  initialProject?: VideoProjectRow | null;
  canEdit: boolean;
  creditBalance: number;
}

export function TimelineEditorWorkspace({
  workspaceId,
  mediaAssets,
  initialProject,
  canEdit,
  creditBalance,
}: TimelineEditorWorkspaceProps) {
  const [projectTitle, setProjectTitle] = React.useState(
    initialProject?.title || "Proyek Video Reels #1"
  );
  const [aspectRatio, setAspectRatio] = React.useState<"9:16" | "16:9" | "1:1">(
    (initialProject?.aspect_ratio as "9:16") || "9:16"
  );
  const [resolution, setResolution] = React.useState<"1080p" | "720p" | "4k">(
    (initialProject?.resolution as "1080p") || "1080p"
  );

  // Initialize tracks
  const defaultTracks: TimelineTrack[] = [
    {
      id: "track-v1",
      type: "video",
      name: "Visual / Video Track",
      muted: false,
      locked: false,
      clips: [
        {
          id: "clip-v1",
          trackId: "track-v1",
          title: "Opening Scene",
          assetType: "image",
          startTime: 0,
          endTime: 5,
          trimStart: 0,
          trimEnd: 5,
          volume: 1,
        },
        {
          id: "clip-v2",
          trackId: "track-v1",
          title: "Main Content Scene",
          assetType: "image",
          startTime: 5,
          endTime: 12,
          trimStart: 0,
          trimEnd: 7,
          volume: 1,
        },
      ],
    },
    {
      id: "track-a1",
      type: "audio",
      name: "Voiceover Narration",
      muted: false,
      locked: false,
      clips: [
        {
          id: "clip-a1",
          trackId: "track-a1",
          title: "Voiceover Narasi Hook",
          assetType: "audio",
          startTime: 0,
          endTime: 12,
          trimStart: 0,
          trimEnd: 12,
          volume: 1,
        },
      ],
    },
    {
      id: "track-s1",
      type: "subtitle",
      name: "Dynamic Subtitles",
      muted: false,
      locked: false,
      clips: [
        {
          id: "clip-s1",
          trackId: "track-s1",
          title: "Pernah merasa konten kamu sepi?",
          assetType: "subtitle",
          startTime: 0,
          endTime: 5,
          trimStart: 0,
          trimEnd: 5,
          volume: 1,
        },
        {
          id: "clip-s2",
          trackId: "track-s1",
          title: "Kuncinya di Hook 3 Detik Pertama!",
          assetType: "subtitle",
          startTime: 5,
          endTime: 12,
          trimStart: 0,
          trimEnd: 7,
          volume: 1,
        },
      ],
    },
    {
      id: "track-o1",
      type: "overlay",
      name: "Text Overlays & CTA",
      muted: false,
      locked: false,
      clips: [
        {
          id: "clip-o1",
          trackId: "track-o1",
          title: "TIPS KREATOR 2026",
          assetType: "text_overlay",
          startTime: 0,
          endTime: 4,
          trimStart: 0,
          trimEnd: 4,
          volume: 1,
          textOverlay: {
            text: "TIPS KREATOR 2026",
            fontSize: 32,
            color: "#FACC15",
            position: "top",
          },
        },
      ],
    },
  ];

  const initialTimelineData = (initialProject?.timeline_data as unknown as TimelineProjectData) || {
    tracks: defaultTracks,
    duration: 12,
  };

  const [tracks, setTracks] = React.useState<TimelineTrack[]>(
    initialTimelineData.tracks?.length ? initialTimelineData.tracks : defaultTracks
  );

  // Playhead & Playback state
  const [playheadTime, setPlayheadTime] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [selectedClipId, setSelectedClipId] = React.useState<string | null>("clip-v1");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  // Calculate project total duration
  const totalDuration = React.useMemo(() => {
    let maxT = 5;
    for (const t of tracks) {
      for (const c of t.clips) {
        if (c.endTime > maxT) maxT = c.endTime;
      }
    }
    return Math.max(5, Math.ceil(maxT));
  }, [tracks]);

  // Playback loop
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setPlayheadTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return Number((prev + 0.1).toFixed(1));
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying, totalDuration]);

  // Find active visual clip, subtitle, and overlay at current playhead
  const visualTrack = tracks.find((t) => t.type === "video");
  const activeVisualClip = visualTrack?.clips.find(
    (c) => playheadTime >= c.startTime && playheadTime < c.endTime
  );

  const subtitleTrack = tracks.find((t) => t.type === "subtitle");
  const activeSubtitleClip = subtitleTrack?.clips.find(
    (c) => playheadTime >= c.startTime && playheadTime < c.endTime
  );

  const overlayTrack = tracks.find((t) => t.type === "overlay");
  const activeOverlayClip = overlayTrack?.clips.find(
    (c) => playheadTime >= c.startTime && playheadTime < c.endTime
  );

  // Selected clip object for inspector
  const allClips = tracks.flatMap((t) => t.clips);
  const selectedClip = allClips.find((c) => c.id === selectedClipId);

  // Split clip at playhead
  const handleSplitClip = () => {
    if (!selectedClip) {
      toast.error("Pilih klip terlebih dahulu untuk di-split.");
      return;
    }
    if (playheadTime <= selectedClip.startTime || playheadTime >= selectedClip.endTime) {
      toast.error("Playhead harus berada di dalam rentang waktu klip yang dipilih.");
      return;
    }

    const firstHalf: TimelineClip = {
      ...selectedClip,
      endTime: playheadTime,
      trimEnd: Number((selectedClip.trimStart + (playheadTime - selectedClip.startTime)).toFixed(1)),
    };

    const secondHalf: TimelineClip = {
      ...selectedClip,
      id: `clip-${Date.now()}`,
      title: `${selectedClip.title} (Part 2)`,
      startTime: playheadTime,
      trimStart: firstHalf.trimEnd,
    };

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== selectedClip.trackId) return t;
        const newClips = t.clips
          .map((c) => (c.id === selectedClip.id ? firstHalf : c))
          .concat([secondHalf])
          .sort((a, b) => a.startTime - b.startTime);
        return { ...t, clips: newClips };
      })
    );

    setSelectedClipId(secondHalf.id);
    toast.success("Klip berhasil di-split pada playhead!");
  };

  // Delete selected clip
  const handleDeleteClip = (clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }))
    );
    if (selectedClipId === clipId) setSelectedClipId(null);
    toast.success("Klip dihapus.");
  };

  // Add clip from Media Library
  const handleAddFromLibrary = (asset: MediaAssetRow) => {
    let targetTrackType: TrackType = "video";
    if (asset.asset_type === "voiceover") targetTrackType = "audio";
    if (asset.asset_type === "subtitle") targetTrackType = "subtitle";

    let targetTrack = tracks.find((t) => t.type === targetTrackType);
    if (!targetTrack) targetTrack = tracks[0];

    const clipDuration = asset.duration_seconds || 5;
    const startTime = playheadTime;
    const endTime = Number((startTime + clipDuration).toFixed(1));

    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      trackId: targetTrack.id,
      title: asset.title,
      assetId: asset.id,
      assetType: asset.asset_type === "voiceover" ? "audio" : asset.asset_type === "video_clip" ? "video" : "image",
      mediaUrl: asset.public_url,
      startTime,
      endTime,
      trimStart: 0,
      trimEnd: clipDuration,
      volume: 1,
    };

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== targetTrack!.id) return t;
        return {
          ...t,
          clips: [...t.clips, newClip].sort((a, b) => a.startTime - b.startTime),
        };
      })
    );

    setSelectedClipId(newClip.id);
    toast.success(`Ditambahkan ke ${targetTrack.name}!`);
  };

  // Add Text Overlay
  const handleAddTextOverlay = () => {
    const oTrack = tracks.find((t) => t.type === "overlay");
    if (!oTrack) return;

    const newClip: TimelineClip = {
      id: `clip-o-${Date.now()}`,
      trackId: oTrack.id,
      title: "Teks Baru",
      assetType: "text_overlay",
      startTime: playheadTime,
      endTime: Number((playheadTime + 4).toFixed(1)),
      trimStart: 0,
      trimEnd: 4,
      volume: 1,
      textOverlay: {
        text: "Ketik teks di sini...",
        fontSize: 32,
        color: "#FFFFFF",
        position: "middle",
      },
    };

    setTracks((prev) =>
      prev.map((t) => (t.id === oTrack.id ? { ...t, clips: [...t.clips, newClip] } : t))
    );
    setSelectedClipId(newClip.id);
    toast.success("Text overlay ditambahkan!");
  };

  // Save Project Action
  const handleSaveProject = async () => {
    setIsSaving(true);
    try {
      const res = await saveVideoProjectAction(workspaceId, {
        title: projectTitle,
        aspectRatio,
        resolution,
        fps: 30,
        timelineData: { tracks, duration: totalDuration },
        projectId: initialProject?.id,
      });

      if (res.success) {
        toast.success("Proyek video berhasil disimpan!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan proyek.");
    } finally {
      setIsSaving(false);
    }
  };

  // Direct Quick Export Trigger
  const handleQuickExport = async () => {
    setIsExporting(true);
    try {
      const res = await queueVideoExportAction(workspaceId, {
        title: projectTitle,
        aspectRatio,
        resolution,
        fps: 30,
        timelineData: { tracks, duration: totalDuration },
        projectId: initialProject?.id,
      });

      if (res.success && res.job) {
        toast.success("Job rendering dikirim ke background worker! Mengalihkan ke Export Center...");
        window.location.href = "/studio/export";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memulai export.");
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Studio Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3.5 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Film className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                aria-label="Judul Proyek Video"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-sm font-semibold bg-transparent text-foreground border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 rounded"
              />
              <Badge variant="outline" className="text-[10px]">
                {totalDuration}s Durasi
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Aspect Ratio Selector */}
          <select
            aria-label="Rasio Aspek Video"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as "9:16" | "16:9" | "1:1")}
            className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 text-foreground focus:outline-none"
          >
            <option value="9:16">9:16 (Vertikal)</option>
            <option value="16:9">16:9 (Horizontal)</option>
            <option value="1:1">1:1 (Persegi)</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSaveProject}
            disabled={isSaving || !canEdit}
            className="gap-1.5 text-xs h-8"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Menyimpan..." : "Simpan"}
          </Button>

          <Button
            size="sm"
            onClick={handleQuickExport}
            disabled={isExporting}
            className="gap-1.5 text-xs h-8"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? "Memulai Export..." : "Export Video"}
          </Button>
        </div>
      </div>

      {/* Main Studio Workspace: Media Library + Preview + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Media Library Panel (Left: 3 cols) */}
        <Card className="lg:col-span-3 border-border bg-card flex flex-col h-[340px]">
          <CardHeader className="py-2 px-3 border-b border-border/60">
            <CardTitle className="text-xs font-semibold flex items-center justify-between">
              <span>Media Library</span>
              <Badge variant="secondary" className="text-[10px]">
                {mediaAssets.length} Aset
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1.5">
            {mediaAssets.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center italic">
                Belum ada aset tersimpan di workspace ini.
              </p>
            ) : (
              mediaAssets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => handleAddFromLibrary(asset)}
                  className="flex items-center justify-between p-2 rounded-md border border-border/60 hover:border-primary/50 bg-background cursor-pointer text-xs transition-colors group"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {asset.asset_type === "image" || asset.asset_type === "thumbnail" ? (
                      <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                    ) : asset.asset_type === "video_clip" ? (
                      <Video className="h-4 w-4 text-cyan-500 shrink-0" />
                    ) : (
                      <Mic className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate text-foreground font-medium">{asset.title}</span>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Video Canvas Preview (Center: 6 cols) */}
        <Card className="lg:col-span-6 border-border bg-black flex flex-col items-center justify-center p-3 relative min-h-[340px] overflow-hidden rounded-xl">
          <div
            className={`relative rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center shadow-2xl transition-all ${
              aspectRatio === "9:16"
                ? "w-[180px] h-[320px]"
                : aspectRatio === "16:9"
                  ? "w-[360px] h-[202px]"
                  : "w-[240px] h-[240px]"
            }`}
          >
            {/* Visual Stream Content */}
            {activeVisualClip?.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeVisualClip.mediaUrl}
                alt="Active Clip"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-3">
                <Film className="h-6 w-6 text-neutral-600 mb-1" />
                <span className="text-[10px] text-neutral-400 font-medium">
                  {activeVisualClip ? activeVisualClip.title : "Tidak ada klip aktif"}
                </span>
              </div>
            )}

            {/* Text Overlay */}
            {activeOverlayClip?.textOverlay && (
              <div
                className={`absolute w-full px-2 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] font-extrabold ${
                  activeOverlayClip.textOverlay.position === "top"
                    ? "top-3"
                    : activeOverlayClip.textOverlay.position === "middle"
                      ? "top-1/2 -translate-y-1/2"
                      : "bottom-8"
                }`}
                style={{
                  color: activeOverlayClip.textOverlay.color,
                  fontSize: `${Math.round(activeOverlayClip.textOverlay.fontSize * 0.45)}px`,
                }}
              >
                {activeOverlayClip.textOverlay.text}
              </div>
            )}

            {/* Subtitle Cue Overlay */}
            {activeSubtitleClip && (
              <div className="absolute bottom-3 w-full px-2 text-center text-white font-extrabold text-xs uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                <span className="bg-black/60 px-1.5 py-0.5 rounded">
                  {activeSubtitleClip.title}
                </span>
              </div>
            )}

            {/* Playhead Badge */}
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-[10px] font-mono px-1.5 py-0.5 rounded text-white">
              {playheadTime.toFixed(1)}s / {totalDuration}s
            </div>
          </div>
        </Card>

        {/* Clip Inspector Panel (Right: 3 cols) */}
        <Card className="lg:col-span-3 border-border bg-card flex flex-col h-[340px]">
          <CardHeader className="py-2 px-3 border-b border-border/60">
            <CardTitle className="text-xs font-semibold flex items-center justify-between">
              <span>Inspektor Klip</span>
              {selectedClip && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {selectedClip.assetType}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex-1 overflow-y-auto space-y-3">
            {selectedClip ? (
              <>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                    Judul Klip:
                  </label>
                  <Input
                    value={selectedClip.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setTracks((prev) =>
                        prev.map((t) => ({
                          ...t,
                          clips: t.clips.map((c) =>
                            c.id === selectedClip.id ? { ...c, title: newTitle } : c
                          ),
                        }))
                      );
                    }}
                    className="text-xs h-7"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                      Mulai (s):
                    </label>
                    <input
                      aria-label="Waktu Mulai Klip (Detik)"
                      type="number"
                      step="0.1"
                      min="0"
                      value={selectedClip.startTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setTracks((prev) =>
                          prev.map((t) => ({
                            ...t,
                            clips: t.clips.map((c) =>
                              c.id === selectedClip.id ? { ...c, startTime: val } : c
                            ),
                          }))
                        );
                      }}
                      className="w-full text-xs rounded border border-input bg-background py-1 px-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                      Selesai (s):
                    </label>
                    <input
                      aria-label="Waktu Selesai Klip (Detik)"
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={selectedClip.endTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0.1;
                        setTracks((prev) =>
                          prev.map((t) => ({
                            ...t,
                            clips: t.clips.map((c) =>
                              c.id === selectedClip.id ? { ...c, endTime: val } : c
                            ),
                          }))
                        );
                      }}
                      className="w-full text-xs rounded border border-input bg-background py-1 px-1.5"
                    />
                  </div>
                </div>

                {selectedClip.assetType === "text_overlay" && selectedClip.textOverlay && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                      Teks Overlay:
                    </label>
                    <Input
                      value={selectedClip.textOverlay.text}
                      onChange={(e) => {
                        const newT = e.target.value;
                        setTracks((prev) =>
                          prev.map((t) => ({
                            ...t,
                            clips: t.clips.map((c) =>
                              c.id === selectedClip.id && c.textOverlay
                                ? { ...c, textOverlay: { ...c.textOverlay, text: newT } }
                                : c
                            ),
                          }))
                        );
                      }}
                      className="text-xs h-7"
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-border/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteClip(selectedClip.id)}
                    className="w-full text-destructive hover:bg-destructive/10 text-xs h-7 gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hapus Klip
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center italic py-6">
                Klik salah satu klip pada track timeline untuk melihat propertinya.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline Controls & Transport Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-lg border border-border text-xs">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-8 gap-1 text-xs"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? "Jeda" : "Mainkan"}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setIsPlaying(false);
              setPlayheadTime(0);
            }}
            className="h-8 w-8"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <span className="font-mono text-xs font-semibold px-2">
            {playheadTime.toFixed(1)}s / {totalDuration}s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSplitClip}
            disabled={!selectedClip}
            className="h-8 gap-1.5 text-xs"
          >
            <Scissors className="h-3.5 w-3.5" />
            Split di Playhead
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAddTextOverlay}
            className="h-8 gap-1.5 text-xs"
          >
            <Type className="h-3.5 w-3.5" />
            + Text Overlay
          </Button>
        </div>
      </div>

      {/* Multi-Track Timeline Canvas */}
      <Card className="border-border bg-card p-3 space-y-3">
        {/* Playhead Time Scrub Slider */}
        <div className="relative pt-1 pb-2">
          <input
            aria-label="Posisi Playhead Waktu Timeline"
            type="range"
            min={0}
            max={totalDuration}
            step={0.1}
            value={playheadTime}
            onChange={(e) => setPlayheadTime(parseFloat(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
        </div>

        {/* Tracks List */}
        <div className="space-y-2">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-2 bg-muted/20 border border-border/80 rounded-lg p-2"
            >
              {/* Track Header Label */}
              <div className="w-36 shrink-0 flex items-center justify-between text-xs pr-2 border-r border-border/60">
                <span className="font-medium truncate text-foreground">{track.name}</span>
                {track.type === "video" && <Film className="h-3.5 w-3.5 text-primary" />}
                {track.type === "audio" && <Mic className="h-3.5 w-3.5 text-amber-500" />}
                {track.type === "subtitle" && <Captions className="h-3.5 w-3.5 text-cyan-500" />}
                {track.type === "overlay" && <Type className="h-3.5 w-3.5 text-emerald-500" />}
              </div>

              {/* Track Content Strip */}
              <div className="relative flex-1 h-10 bg-background/50 rounded overflow-hidden flex items-center px-1">
                {track.clips.map((clip) => {
                  const isSelected = selectedClipId === clip.id;
                  const leftPercent = (clip.startTime / totalDuration) * 100;
                  const widthPercent = ((clip.endTime - clip.startTime) / totalDuration) * 100;

                  return (
                    <div
                      key={clip.id}
                      onClick={() => setSelectedClipId(clip.id)}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(4, widthPercent)}%`,
                      }}
                      className={`absolute h-8 rounded px-2 flex items-center justify-between text-[11px] font-medium cursor-pointer transition-all border ${
                        isSelected
                          ? "ring-2 ring-primary border-primary bg-primary/25 text-foreground z-10"
                          : "border-border bg-muted/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{clip.title}</span>
                      <span className="text-[10px] font-mono opacity-60 ml-1">
                        {(clip.endTime - clip.startTime).toFixed(1)}s
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
