"use client";

import * as React from "react";
import Link from "next/link";
import {
  Mic,
  Play,
  Pause,
  Download,
  Film,
  Sparkles,
  Volume2,
  Clock,
  User,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateVoiceoverAction } from "@/features/production-studio/actions";
import type { MediaAssetRow } from "@/lib/supabase/types";
import {
  VOICE_PERSONAS,
  type VoicePersonaId,
  type VoiceLanguage,
} from "@/lib/validation/production-schemas";

interface VoiceStudioWorkspaceProps {
  workspaceId: string;
  initialAssets: MediaAssetRow[];
  prefilledText?: string;
  prefilledScene?: number;
  canEdit: boolean;
  creditBalance: number;
}

export function VoiceStudioWorkspace({
  workspaceId,
  initialAssets,
  prefilledText = "",
  prefilledScene,
  canEdit,
  creditBalance,
}: VoiceStudioWorkspaceProps) {
  const [assets, setAssets] = React.useState<MediaAssetRow[]>(initialAssets);
  const [language, setLanguage] = React.useState<VoiceLanguage>("id");
  const [personaId, setPersonaId] = React.useState<VoicePersonaId>("budi_energetic");
  const [speed, setSpeed] = React.useState<number>(1.0);
  const [pitch, setPitch] = React.useState<number>(1.0);
  const [text, setText] = React.useState(
    prefilledText ||
      "Pernah merasa konten kamu sepi audiens padahal udah riset mati-matian? Masalahnya bukan di algoritma, tapi di cara penyusunan hook 3 detik pertama."
  );
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [activePlayId, setActivePlayId] = React.useState<string | null>(null);

  // Word count and estimated duration calculation
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 2.5) / speed));

  const filteredPersonas = VOICE_PERSONAS.filter((p) => p.lang === language);

  const handleGenerate = async () => {
    if (!text.trim() || text.trim().length < 3) {
      toast.error("Naskah voiceover minimal 3 karakter.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateVoiceoverAction(workspaceId, {
        text,
        language,
        personaId,
        speed,
        pitch,
        sceneNumber: prefilledScene,
      });

      if (res.success && res.asset) {
        setAssets((prev) => [res.asset, ...prev]);
        toast.success("Voiceover berhasil dibuat dan siap dipratinjau!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghasilkan voiceover.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Voice Studio</h2>
              <Badge variant="outline" className="text-xs">
                {assets.length} Rekaman Suara
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Konversi naskah menjadi audio sulih suara (voiceover) alami dalam Bahasa Indonesia dan Inggris.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Kredit: 2 per generasi (Tersedia: {creditBalance})
          </Badge>
          <Link href="/studio/timeline">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Film className="h-4 w-4" />
              Buka Timeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Voice Configuration & Generator */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Konfigurasi Suara & Karakter
          </CardTitle>
          <CardDescription className="text-xs">
            Pilih bahasa, persona suara kreator, kecepatan bicara, dan masukkan teks naskah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Language Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Pilihan Bahasa:
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLanguage("id");
                  setPersonaId("budi_energetic");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  language === "id"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                🇮🇩 Bahasa Indonesia
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage("en");
                  setPersonaId("clara_executive");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  language === "en"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                🇺🇸 English (Multilingual)
              </button>
            </div>
          </div>

          {/* Persona Cards */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Persona Karakter Suara:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredPersonas.map((p) => {
                const isSelected = personaId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersonaId(p.id as VoicePersonaId)}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {p.gender === "male" ? "Pria" : "Wanita"} • {p.lang.toUpperCase()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed & Pitch Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Kecepatan Bicara (Speed):
                </label>
                <span className="text-xs font-semibold text-foreground">{speed.toFixed(1)}x</span>
              </div>
              <input
                aria-label="Kecepatan Bicara"
                type="range"
                min={0.8}
                max={1.6}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Nada Suara (Pitch):
                </label>
                <span className="text-xs font-semibold text-foreground">{pitch.toFixed(1)}x</span>
              </div>
              <input
                aria-label="Nada Suara"
                type="range"
                min={0.8}
                max={1.3}
                step={0.1}
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          </div>

          {/* Text Input & Metrics */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-muted-foreground">
                Teks Naskah Voiceover:
              </label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{wordCount} kata</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Clock className="h-3 w-3 text-primary" />
                  ~{estimatedSeconds}s durasi
                </span>
              </div>
            </div>
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ketikkan naskah yang ingin disuarakan..."
              className="text-xs"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !canEdit || text.trim().length < 3}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Mensintesis Suara..." : "Hasilkan Voiceover Sekarang"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Voiceover Assets List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Daftar Voiceover Terbuat
            <Badge variant="outline" className="text-xs">
              {assets.length}
            </Badge>
          </h3>
        </div>

        {assets.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-card/40">
            <Volume2 className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-foreground">Belum ada voiceover yang dibuat</p>
            <p className="text-xs text-muted-foreground mt-1">
              Gunakan form di atas untuk membuat suara narasi pertama untuk konten Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset) => {
              const meta = (asset.metadata as Record<string, unknown>) || {};
              const assetPersona = (meta.personaId as string) || "Persona";
              const assetLang = (meta.language as string) || "id";
              const assetDuration = asset.duration_seconds || 5;

              return (
                <Card
                  key={asset.id}
                  className="border-border bg-card p-4 shadow-sm hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                          {assetLang} • {assetPersona.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {assetDuration} detik
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground line-clamp-2">
                        {asset.title}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {/* Real Audio Player */}
                      <audio
                        controls
                        src={asset.public_url}
                        className="h-9 w-60 sm:w-64 rounded-md"
                        preload="none"
                      />

                      <div className="flex items-center gap-2">
                        <a
                          href={asset.public_url}
                          download={`voiceover_${asset.id}.wav`}
                        >
                          <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs">
                            <Download className="h-3.5 w-3.5" />
                            Unduh
                          </Button>
                        </a>

                        <Link href="/studio/timeline">
                          <Button size="sm" variant="secondary" className="h-9 gap-1.5 text-xs">
                            <Film className="h-3.5 w-3.5" />
                            Timeline
                          </Button>
                        </Link>
                      </div>
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
