"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clapperboard,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Clock,
  Image as ImageIcon,
  Mic,
  Video,
  Film,
  Layers,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  saveStoryboardAction,
  generateAiStoryboardAction,
} from "@/features/production-studio/actions";
import type { StoryboardRow } from "@/lib/supabase/types";
import type {
  StoryboardScene,
  ShotType,
  TransitionType,
} from "@/lib/validation/production-schemas";

interface ScriptOption {
  id: string;
  title: string;
  openingHook: string;
  bodyContent: string;
  closingCta: string;
}

interface StoryboardStudioWorkspaceProps {
  workspaceId: string;
  initialStoryboards: StoryboardRow[];
  scripts: ScriptOption[];
  canEdit: boolean;
  creditBalance: number;
}

export function StoryboardStudioWorkspace({
  workspaceId,
  initialStoryboards,
  scripts,
  canEdit,
  creditBalance,
}: StoryboardStudioWorkspaceProps) {
  const [storyboards, setStoryboards] = React.useState<StoryboardRow[]>(initialStoryboards);
  const [selectedStoryboardId, setSelectedStoryboardId] = React.useState<string | null>(
    initialStoryboards[0]?.id ?? null
  );

  const [title, setTitle] = React.useState("Storyboard Baru");
  const [visualTheme, setVisualTheme] = React.useState("cinematic");
  const [scenes, setScenes] = React.useState<StoryboardScene[]>([
    {
      sceneNumber: 1,
      durationSeconds: 5,
      shotType: "close_up",
      shotDescription: "Kreator tersenyum di depan kamera dengan pencahayaan warm ring light",
      visualDirection: "Camera push-in perlahan, fokus pada ekspresi",
      voiceoverText: "Pernah merasa konten kamu sepi audiens padahal udah riset mati-matian?",
      subtitleText: "Konten sepi padahal udah riset?",
      transitionSuggestion: "cut",
    },
    {
      sceneNumber: 2,
      durationSeconds: 7,
      shotType: "medium",
      shotDescription: "B-roll layar laptop menampilkan analytics dashboard CreatorOS AI",
      visualDirection: "Sudut over-the-shoulder, cursor menunjuk grafik tren",
      voiceoverText: "Masalahnya bukan di algoritma, tapi di cara penyusunan hook dan struktur storytelling.",
      subtitleText: "Kuncinya di Hook & Storytelling",
      transitionSuggestion: "dissolve",
    },
  ]);

  const [selectedScriptId, setSelectedScriptId] = React.useState<string>("");
  const [manualScriptText, setManualScriptText] = React.useState("");
  const [isAiGenerating, setIsAiGenerating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Load selected storyboard into editor
  React.useEffect(() => {
    if (!selectedStoryboardId) return;
    const sb = storyboards.find((s) => s.id === selectedStoryboardId);
    if (sb) {
      setTitle(sb.title);
      setVisualTheme(sb.visual_theme);
      if (Array.isArray(sb.scenes) && sb.scenes.length > 0) {
        setScenes(sb.scenes as unknown as StoryboardScene[]);
      }
    }
  }, [selectedStoryboardId, storyboards]);

  const totalDuration = scenes.reduce((acc, sc) => acc + (sc.durationSeconds || 0), 0);

  const handleAddScene = () => {
    const newNum = scenes.length + 1;
    setScenes((prev) => [
      ...prev,
      {
        sceneNumber: newNum,
        durationSeconds: 5,
        shotType: "medium",
        shotDescription: `Adegan visual #${newNum}`,
        visualDirection: "Static camera framing sejajar mata",
        voiceoverText: "",
        subtitleText: "",
        transitionSuggestion: "cut",
      },
    ]);
  };

  const handleRemoveScene = (idx: number) => {
    if (scenes.length <= 1) {
      toast.error("Storyboard minimal harus memiliki 1 adegan.");
      return;
    }
    const updated = scenes
      .filter((_, i) => i !== idx)
      .map((sc, i) => ({ ...sc, sceneNumber: i + 1 }));
    setScenes(updated);
  };

  const handleMoveScene = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= scenes.length) return;
    const updated = [...scenes];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setScenes(updated.map((sc, i) => ({ ...sc, sceneNumber: i + 1 })));
  };

  const handleUpdateScene = <K extends keyof StoryboardScene>(
    idx: number,
    field: K,
    val: StoryboardScene[K]
  ) => {
    setScenes((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleGenerateAiBreakdown = async () => {
    let scriptContent = manualScriptText;
    let autoTitle = title;
    if (selectedScriptId) {
      const scr = scripts.find((s) => s.id === selectedScriptId);
      if (scr) {
        scriptContent = `${scr.openingHook}\n\n${scr.bodyContent}\n\n${scr.closingCta}`;
        autoTitle = `Storyboard: ${scr.title}`;
      }
    }

    if (!scriptContent || scriptContent.trim().length < 5) {
      toast.error("Silakan pilih naskah atau ketikkan naskah minimal 5 karakter.");
      return;
    }

    setIsAiGenerating(true);
    try {
      const res = await generateAiStoryboardAction(workspaceId, {
        scriptText: scriptContent,
        title: autoTitle,
        visualTheme,
      });

      if (res.success && res.data) {
        setTitle(res.data.title);
        setVisualTheme(res.data.visualTheme);
        setScenes(res.data.scenes);
        toast.success(`Berhasil mengurai ${res.data.scenes.length} adegan storyboard!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengurai storyboard dengan AI.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Judul storyboard wajib diisi.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveStoryboardAction(workspaceId, {
        storyboardId: selectedStoryboardId,
        title,
        visualTheme,
        scenes,
      });

      if (res.success) {
        toast.success("Storyboard berhasil disimpan!");
        if (!selectedStoryboardId) {
          setSelectedStoryboardId(res.id);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan storyboard.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Storyboard Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clapperboard className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Storyboard Studio</h2>
              <Badge variant="outline" className="text-xs">
                {scenes.length} Adegan • {totalDuration} detik
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Konversi naskah menjadi arahan visual scene-by-scene yang siap diproduksi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {storyboards.length > 0 && (
            <select
              aria-label="Pilih Storyboard yang Ada"
              value={selectedStoryboardId ?? ""}
              onChange={(e) => setSelectedStoryboardId(e.target.value || null)}
              className="text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {storyboards.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.title} ({sb.total_duration_seconds}s)
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedStoryboardId(null);
              setTitle("Storyboard Baru");
              setScenes([
                {
                  sceneNumber: 1,
                  durationSeconds: 5,
                  shotType: "medium",
                  shotDescription: "Adegan pembuka",
                  visualDirection: "Sudut mata sejajar",
                  voiceoverText: "",
                  subtitleText: "",
                  transitionSuggestion: "cut",
                },
              ]);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Baru
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canEdit || isSaving}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>

      {/* AI Breakdown Generator Accordion / Box */}
      <Card className="border-border bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">AI Scene Breakdown Generator</CardTitle>
            </div>
            <Badge variant="secondary" className="text-xs">
              Biaya: 3 Kredit (Tersedia: {creditBalance})
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Pilih naskah dari Script Studio atau tempelkan teks untuk otomatis dibreakdown menjadi visual, shot, voiceover, dan subtitle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Pilih Naskah Tersimpan:
              </label>
              <select
                aria-label="Pilih Naskah Tersimpan"
                value={selectedScriptId}
                onChange={(e) => {
                  setSelectedScriptId(e.target.value);
                  const scr = scripts.find((s) => s.id === e.target.value);
                  if (scr) {
                    setManualScriptText(`${scr.openingHook}\n\n${scr.bodyContent}\n\n${scr.closingCta}`);
                  }
                }}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">-- Buat dari naskah manual di bawah --</option>
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Tema Visual:
              </label>
              <select
                aria-label="Tema Visual"
                value={visualTheme}
                onChange={(e) => setVisualTheme(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="cinematic">Cinematic Modern (High Contrast, Moody)</option>
                <option value="vibrant_creator">Vibrant Creator (Bright, Energetic, YouTube/TikTok)</option>
                <option value="minimalist">Minimalist Clean (Monochrome, Elegant)</option>
                <option value="corporate">Executive Corporate (Clean, Trustworthy)</option>
                <option value="cyberpunk">Cyberpunk Neon (Futuristic, High Tech)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Teks Naskah:
            </label>
            <Textarea
              value={manualScriptText}
              onChange={(e) => setManualScriptText(e.target.value)}
              placeholder="Tempelkan naskah video Anda di sini (Hook, Isi Konten, CTA)..."
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleGenerateAiBreakdown}
              disabled={isAiGenerating || (!selectedScriptId && manualScriptText.trim().length < 5)}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {isAiGenerating ? "Menganalisis Naskah..." : "Hasilkan Adegan dengan AI"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storyboard Settings Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Judul Storyboard:
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm font-medium"
            placeholder="Misal: 3 Cara Bikin Konten Edukasi Cepat"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Total Estimasi Durasi:
          </label>
          <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/40 text-foreground text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-semibold">{totalDuration} detik</span>
            <span className="text-xs text-muted-foreground">({scenes.length} adegan)</span>
          </div>
        </div>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        {scenes.map((scene, idx) => (
          <Card key={idx} className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors">
            <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs font-semibold px-2 py-0.5">
                    Adegan {scene.sceneNumber}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <input
                      aria-label="Durasi Adegan (Detik)"
                      type="number"
                      min={1}
                      max={60}
                      value={scene.durationSeconds}
                      onChange={(e) =>
                        handleUpdateScene(idx, "durationSeconds", parseInt(e.target.value, 10) || 1)
                      }
                      className="w-12 text-center rounded border border-input bg-background py-0.5 text-xs"
                    />
                    <span>detik</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Reorder Buttons */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === 0}
                    onClick={() => handleMoveScene(idx, "up")}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === scenes.length - 1}
                    onClick={() => handleMoveScene(idx, "down")}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveScene(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Tipe Shot Kamera:
                  </label>
                  <select
                    aria-label="Tipe Shot Kamera"
                    value={scene.shotType}
                    onChange={(e) =>
                      handleUpdateScene(idx, "shotType", e.target.value as ShotType)
                    }
                    className="w-full text-xs rounded-md border border-input bg-background px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="close_up">Close-Up (Fokus wajah / detail)</option>
                    <option value="medium">Medium Shot (Dada ke atas)</option>
                    <option value="wide">Wide Shot (Pemandangan / full body)</option>
                    <option value="over_shoulder">Over-the-Shoulder (Melihat ke layar/subjek)</option>
                    <option value="aerial">Aerial / Top-Down (Dari atas)</option>
                    <option value="pov">POV (Point of View sudut pandang kreator)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Saran Transisi:
                  </label>
                  <select
                    aria-label="Saran Transisi"
                    value={scene.transitionSuggestion}
                    onChange={(e) =>
                      handleUpdateScene(idx, "transitionSuggestion", e.target.value as TransitionType)
                    }
                    className="w-full text-xs rounded-md border border-input bg-background px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="cut">Hard Cut (Pindah langsung)</option>
                    <option value="fade">Fade to Black / White</option>
                    <option value="dissolve">Cross Dissolve (Melebur halus)</option>
                    <option value="wipe">Wipe (Geser samping)</option>
                    <option value="zoom_in">Quick Zoom In (Punch-in dinamis)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Deskripsi Visual (Shot Description):
                  </label>
                  <Textarea
                    rows={2}
                    value={scene.shotDescription}
                    onChange={(e) => handleUpdateScene(idx, "shotDescription", e.target.value)}
                    placeholder="Apa yang terlihat di layar..."
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Arahan Visual & Kamera (Visual Direction):
                  </label>
                  <Textarea
                    rows={2}
                    value={scene.visualDirection}
                    onChange={(e) => handleUpdateScene(idx, "visualDirection", e.target.value)}
                    placeholder="Gerakan kamera, pencahayaan, grading..."
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-border/40">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Teks Voiceover (Audio Cue):
                  </label>
                  <Textarea
                    rows={2}
                    value={scene.voiceoverText}
                    onChange={(e) => handleUpdateScene(idx, "voiceoverText", e.target.value)}
                    placeholder="Kalimat yang diucapkan kreator pada adegan ini..."
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Teks Subtitle di Layar (On-Screen Text):
                  </label>
                  <Textarea
                    rows={2}
                    value={scene.subtitleText}
                    onChange={(e) => handleUpdateScene(idx, "subtitleText", e.target.value)}
                    placeholder="Teks ringkas yang muncul sebagai subtitle / banner..."
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Quick Jump Action Links */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground">Kirim adegan ini ke studio lain:</span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/studio/images?prompt=${encodeURIComponent(scene.shotDescription)}&scene=${scene.sceneNumber}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Buat Gambar
                  </Link>
                  <span className="text-muted-foreground">•</span>
                  <Link
                    href={`/studio/voice?text=${encodeURIComponent(scene.voiceoverText || scene.shotDescription)}&scene=${scene.sceneNumber}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    Buat Voiceover
                  </Link>
                  <span className="text-muted-foreground">•</span>
                  <Link
                    href={`/studio/video?prompt=${encodeURIComponent(scene.shotDescription)}&scene=${scene.sceneNumber}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Buat Video Clip
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
        <Button variant="outline" size="sm" onClick={handleAddScene} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Tambah Adegan
        </Button>

        <div className="flex items-center gap-3">
          <Link href="/studio/timeline">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Film className="h-4 w-4" />
              Buka di Timeline Editor
            </Button>
          </Link>

          <Button size="sm" onClick={handleSave} disabled={!canEdit || isSaving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {isSaving ? "Menyimpan..." : "Simpan Storyboard"}
          </Button>
        </div>
      </div>
    </div>
  );
}
