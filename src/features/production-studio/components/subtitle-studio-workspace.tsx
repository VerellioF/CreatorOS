"use client";

import * as React from "react";
import Link from "next/link";
import {
  Captions,
  Plus,
  Trash2,
  Download,
  Film,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Type,
  Palette,
  AlignVerticalJustifyCenter,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateSubtitlesAction } from "@/features/production-studio/actions";
import { SubtitleGenerator } from "@/lib/media/subtitle-generator";
import type {
  SubtitleCue,
  SubtitleStyling,
  SubtitleFont,
  SubtitlePosition,
} from "@/lib/validation/production-schemas";

interface SubtitleStudioWorkspaceProps {
  workspaceId: string;
  prefilledText?: string;
  canEdit: boolean;
}

export function SubtitleStudioWorkspace({
  workspaceId,
  prefilledText = "",
  canEdit,
}: SubtitleStudioWorkspaceProps) {
  const [inputText, setInputText] = React.useState(
    prefilledText ||
      "Pernah merasa konten kamu sepi audiens padahal udah riset mati-matian? Masalahnya bukan di algoritma, tapi di cara penyusunan hook 3 detik pertama."
  );

  const [cues, setCues] = React.useState<SubtitleCue[]>([
    { id: "cue-1", startTimeSeconds: 0, endTimeSeconds: 2.2, text: "Pernah merasa konten kamu sepi?" },
    { id: "cue-2", startTimeSeconds: 2.2, endTimeSeconds: 4.5, text: "Padahal udah riset mati-matian!" },
    { id: "cue-3", startTimeSeconds: 4.5, endTimeSeconds: 7.0, text: "Masalahnya bukan di algoritma," },
    { id: "cue-4", startTimeSeconds: 7.0, endTimeSeconds: 9.8, text: "Tapi di Hook 3 Detik Pertama!" },
  ]);

  const [styling, setStyling] = React.useState<SubtitleStyling>({
    fontFamily: "montserrat",
    fontSize: 28,
    textColor: "#FFFFFF",
    highlightColor: "#FACC15",
    position: "bottom",
    uppercase: true,
  });

  // Simulated playback time for preview
  const [playbackTime, setPlaybackTime] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const totalDuration = cues.length > 0 ? cues[cues.length - 1].endTimeSeconds : 10;

  // Playback timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackTime((prev) => {
          if (prev >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return Number((prev + 0.1).toFixed(1));
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalDuration]);

  // Current active cue at playbackTime
  const activeCue = cues.find(
    (c) => playbackTime >= c.startTimeSeconds && playbackTime < c.endTimeSeconds
  );

  const handleAutoGenerate = async () => {
    if (!inputText.trim()) {
      toast.error("Silakan masukkan teks terlebih dahulu.");
      return;
    }

    try {
      const res = await generateSubtitlesAction(workspaceId, inputText);
      if (res.success && res.cues) {
        setCues(res.cues);
        setPlaybackTime(0);
        toast.success(`Berhasil membuat ${res.cues.length} segmen subtitle tersinkronisasi!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengurai subtitle.");
    }
  };

  const handleAddCue = () => {
    const lastCue = cues[cues.length - 1];
    const newStart = lastCue ? lastCue.endTimeSeconds : 0;
    const newEnd = Number((newStart + 2.5).toFixed(1));

    setCues((prev) => [
      ...prev,
      {
        id: `cue-${prev.length + 1}`,
        startTimeSeconds: newStart,
        endTimeSeconds: newEnd,
        text: "Teks subtitle baru",
      },
    ]);
  };

  const handleUpdateCue = <K extends keyof SubtitleCue>(
    idx: number,
    field: K,
    val: SubtitleCue[K]
  ) => {
    setCues((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleDeleteCue = (idx: number) => {
    if (cues.length <= 1) {
      toast.error("Minimal harus ada 1 baris subtitle.");
      return;
    }
    setCues((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDownload = (format: "srt" | "vtt" | "json") => {
    let content = "";
    let mime = "text/plain";
    let filename = `subtitles.${format}`;

    if (format === "srt") {
      content = SubtitleGenerator.exportToSrt(cues);
      mime = "application/x-subrip";
    } else if (format === "vtt") {
      content = SubtitleGenerator.exportToVtt(cues);
      mime = "text/vtt";
    } else if (format === "json") {
      content = SubtitleGenerator.exportToJson(cues, styling);
      mime = "application/json";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`File .${format} berhasil diunduh!`);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Captions className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Subtitle Studio</h2>
              <Badge variant="outline" className="text-xs">
                {cues.length} Cues • {totalDuration.toFixed(1)}s
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Segmentasi subtitle otomatis berbasis waktu, styling dinamis ala konten viral, dan ekspor ke SRT/VTT.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => handleDownload("srt")} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            .SRT
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload("vtt")} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            .VTT
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleDownload("json")} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            .JSON
          </Button>
          <Link href="/studio/timeline">
            <Button size="sm" className="gap-1.5 text-xs">
              <Film className="h-4 w-4" />
              Ke Timeline Editor
            </Button>
          </Link>
        </div>
      </div>

      {/* Auto Segmentation Form */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Segmentasi Subtitle Otomatis
          </CardTitle>
          <CardDescription className="text-xs">
            Masukkan naskah atau transkrip untuk secara otomatis dipotong menjadi cue singkat punchy (4-6 kata per layar).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ketik atau tempelkan teks narasi di sini..."
            className="text-xs"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAutoGenerate} disabled={!inputText.trim()} className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Generate Cues Otomatis
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview & Styling Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Visual Preview Box */}
        <Card className="md:col-span-1 border-border bg-card flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Live Subtitle Preview (9:16)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-[240px] aspect-[9/16] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl flex flex-col justify-between p-4">
              <div className="flex justify-between items-center text-[10px] text-neutral-400">
                <span>PREVIEW</span>
                <span className="font-mono">{playbackTime.toFixed(1)}s</span>
              </div>

              {/* Subtitle On-Screen Overlay */}
              <div
                className={`text-center px-2 py-1 transition-all ${
                  styling.position === "top"
                    ? "mt-4"
                    : styling.position === "middle"
                      ? "my-auto"
                      : "mb-6"
                }`}
              >
                {activeCue ? (
                  <div
                    style={{
                      fontFamily: styling.fontFamily,
                      fontSize: `${Math.round(styling.fontSize * 0.7)}px`,
                      color: styling.textColor,
                      textTransform: styling.uppercase ? "uppercase" : "none",
                      backgroundColor: styling.backgroundColor || "transparent",
                    }}
                    className="font-extrabold leading-tight tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                  >
                    <span>{activeCue.text}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-neutral-600 italic">...</span>
                )}
              </div>

              {/* Playback Progress Bar */}
              <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-100"
                  style={{ width: `${Math.min(100, (playbackTime / totalDuration) * 100)}%` }}
                />
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPlaying(!isPlaying)}
                className="gap-1.5 text-xs h-8"
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? "Jeda" : "Mainkan"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsPlaying(false);
                  setPlaybackTime(0);
                }}
                className="h-8 w-8"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Styling Settings */}
        <Card className="md:col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              Pengaturan Gaya Subtitle (Viral Caption Preset)
            </CardTitle>
            <CardDescription className="text-xs">
              Sesuaikan font, warna teks, warna highlight, posisi di layar, dan format huruf.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Font Family:
                </label>
                <select
                  aria-label="Font Family"
                  value={styling.fontFamily}
                  onChange={(e) =>
                    setStyling((prev) => ({ ...prev, fontFamily: e.target.value as SubtitleFont }))
                  }
                  className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="montserrat">Montserrat (Tebal, Modern Short Video)</option>
                  <option value="bebas_neue">Bebas Neue (Punchy Headline All-Caps)</option>
                  <option value="poppins">Poppins (Bersih, Friendly)</option>
                  <option value="inter">Inter (Minimalist Clean)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Posisi Subtitle di Layar:
                </label>
                <select
                  aria-label="Posisi Subtitle di Layar"
                  value={styling.position}
                  onChange={(e) =>
                    setStyling((prev) => ({ ...prev, position: e.target.value as SubtitlePosition }))
                  }
                  className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="bottom">Bawah Layar (Standar)</option>
                  <option value="middle">Tengah Layar (Viral Punchy)</option>
                  <option value="top">Atas Layar</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Warna Teks:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Warna Teks"
                    type="color"
                    value={styling.textColor}
                    onChange={(e) => setStyling((prev) => ({ ...prev, textColor: e.target.value }))}
                    className="h-8 w-10 p-0 rounded border border-input cursor-pointer"
                  />
                  <span className="text-xs font-mono">{styling.textColor}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Warna Highlight:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Warna Highlight"
                    type="color"
                    value={styling.highlightColor}
                    onChange={(e) =>
                      setStyling((prev) => ({ ...prev, highlightColor: e.target.value }))
                    }
                    className="h-8 w-10 p-0 rounded border border-input cursor-pointer"
                  />
                  <span className="text-xs font-mono">{styling.highlightColor}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Format Huruf:
                </label>
                <label className="flex items-center gap-2 h-8 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styling.uppercase}
                    onChange={(e) =>
                      setStyling((prev) => ({ ...prev, uppercase: e.target.checked }))
                    }
                    className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                  />
                  <span>Semua Huruf Besar (UPPERCASE)</span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Cue List Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Tabel Cue Subtitle</CardTitle>
            <CardDescription className="text-xs">
              Sunting langsung teks dan timecode setiap baris subtitle.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={handleAddCue} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Tambah Baris
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cues.map((cue, idx) => (
              <div
                key={cue.id}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-2.5 rounded-lg border border-border/80 bg-background hover:bg-muted/30 transition-colors"
              >
                <span className="text-xs font-mono text-muted-foreground w-8">#{idx + 1}</span>

                <div className="flex items-center gap-1.5">
                  <input
                    aria-label={`Mulai Cue #${idx + 1} (Detik)`}
                    type="number"
                    step="0.1"
                    min="0"
                    value={cue.startTimeSeconds}
                    onChange={(e) =>
                      handleUpdateCue(idx, "startTimeSeconds", parseFloat(e.target.value) || 0)
                    }
                    className="w-16 text-center text-xs rounded border border-input bg-background py-1"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <input
                    aria-label={`Selesai Cue #${idx + 1} (Detik)`}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={cue.endTimeSeconds}
                    onChange={(e) =>
                      handleUpdateCue(idx, "endTimeSeconds", parseFloat(e.target.value) || 0.1)
                    }
                    className="w-16 text-center text-xs rounded border border-input bg-background py-1"
                  />
                </div>

                <Input
                  aria-label={`Teks Cue #${idx + 1}`}
                  value={cue.text}
                  onChange={(e) => handleUpdateCue(idx, "text", e.target.value)}
                  className="flex-1 text-xs h-8"
                  placeholder="Teks subtitle..."
                />

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteCue(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
