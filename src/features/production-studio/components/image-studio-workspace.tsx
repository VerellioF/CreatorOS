"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Copy,
  Layers,
  Film,
  ZoomIn,
  RefreshCw,
  Sliders,
  Check,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { generateImageAction } from "@/features/production-studio/actions";
import type { MediaAssetRow } from "@/lib/supabase/types";
import type {
  ImageGenerationMode,
  ImageAspectRatio,
  ImageStylePreset,
} from "@/lib/validation/production-schemas";

interface ImageStudioWorkspaceProps {
  workspaceId: string;
  initialAssets: MediaAssetRow[];
  prefilledPrompt?: string;
  prefilledScene?: number;
  canEdit: boolean;
  creditBalance: number;
}

export function ImageStudioWorkspace({
  workspaceId,
  initialAssets,
  prefilledPrompt = "",
  prefilledScene,
  canEdit,
  creditBalance,
}: ImageStudioWorkspaceProps) {
  const [assets, setAssets] = React.useState<MediaAssetRow[]>(initialAssets);
  const [mode, setMode] = React.useState<ImageGenerationMode>(
    prefilledScene ? "scene_visual" : "thumbnail"
  );
  const [prompt, setPrompt] = React.useState(
    prefilledPrompt || "Seorang kreator muda Indonesia tersenyum dengan latar belakang studio neon modern"
  );
  const [aspectRatio, setAspectRatio] = React.useState<ImageAspectRatio>("9:16");
  const [style, setStyle] = React.useState<ImageStylePreset>("cinematic");
  const [negativePrompt, setNegativePrompt] = React.useState("buram, teks tidak jelas, distorsi wajah");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [previewAsset, setPreviewAsset] = React.useState<MediaAssetRow | null>(null);

  const handleGenerate = async (overridePrompt?: string, overrideMode?: ImageGenerationMode) => {
    const activePrompt = overridePrompt || prompt;
    if (!activePrompt.trim() || activePrompt.trim().length < 3) {
      toast.error("Prompt gambar minimal 3 karakter.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await generateImageAction(workspaceId, {
        mode: overrideMode || mode,
        prompt: activePrompt,
        aspectRatio,
        style,
        negativePrompt,
        sceneNumber: prefilledScene,
      });

      if (res.success && res.asset) {
        setAssets((prev) => [res.asset, ...prev]);
        setPreviewAsset(res.asset);
        toast.success("Gambar berhasil dihasilkan!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghasilkan gambar.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariation = (asset: MediaAssetRow) => {
    const origPrompt = (asset.metadata as Record<string, unknown>)?.prompt as string || asset.title;
    const variationPrompt = `Variasi sudut dan pencahayaan alternatif: ${origPrompt}`;
    handleGenerate(variationPrompt, "variation");
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Image Studio</h2>
              <Badge variant="outline" className="text-xs">
                {assets.length} Aset Gambar
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Hasilkan thumbnail video, scene visual storyboard, aset brand visual, dan variasi gambar.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Kredit: 2 per gambar (Tersedia: {creditBalance})
          </Badge>
          <Link href="/studio/timeline">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <Film className="h-4 w-4" />
              Buka Timeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Generation Controls */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Konfigurasi Pembuatan Gambar
          </CardTitle>
          <CardDescription className="text-xs">
            Atur tipe gambar, rasio aspek target, gaya visual, dan prompt detail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Tipe Gambar (Mode):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "thumbnail", label: "Thumbnail Video", desc: "Eye-catching click-worthy" },
                { id: "scene_visual", label: "Scene Visual", desc: "Ilustrasi adegan storyboard" },
                { id: "brand_visual", label: "Brand Visual", desc: "Aset grafis & identitas brand" },
                { id: "variation", label: "Image Variation", desc: "Variasi sudut & grading" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as ImageGenerationMode)}
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

          {/* Aspect Ratio & Style Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Rasio Aspek (Aspect Ratio):
              </label>
              <select
                aria-label="Rasio Aspek"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as ImageAspectRatio)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="9:16">9:16 (Vertikal - TikTok, Reels, Shorts)</option>
                <option value="16:9">16:9 (Horizontal - YouTube, Website)</option>
                <option value="1:1">1:1 (Persegi - Feed Instagram)</option>
                <option value="4:5">4:5 (Potret - Instagram Post)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Preset Gaya Visual (Style):
              </label>
              <select
                aria-label="Preset Gaya Visual"
                value={style}
                onChange={(e) => setStyle(e.target.value as ImageStylePreset)}
                className="w-full text-xs rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="cinematic">Cinematic (Pencahayaan dramatis, lensa anamorphic)</option>
                <option value="photorealistic">Photorealistic (Kamera DSLR nyata, detail kulit natural)</option>
                <option value="vibrant_creator">Vibrant Creator (Warna cerah, high saturation pop)</option>
                <option value="3d_render">3D Render (Octane Render, clay/stylized 3D)</option>
                <option value="minimalist">Minimalist (Ruang negatif bersih, monokromatik)</option>
                <option value="cyberpunk">Cyberpunk (Lampu neon, bayangan malam, futuristic)</option>
              </select>
            </div>
          </div>

          {/* Prompt Input */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Prompt Deskripsi Gambar:
            </label>
            <Textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Deskripsikan subjek, ekspresi, pencahayaan, sudut kamera, dan suasana secara detail..."
              className="text-xs"
            />
          </div>

          {/* Negative Prompt */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Negative Prompt (Elemen yang Dihindari):
            </label>
            <Input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="buram, cacat, teks berantakan..."
              className="text-xs"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => handleGenerate()}
              disabled={isGenerating || !canEdit || prompt.trim().length < 3}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Menghasilkan Gambar..." : "Buat Gambar Sekarang"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gallery of Assets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Galeri Gambar Terbuat
            <Badge variant="outline" className="text-xs">
              {assets.length}
            </Badge>
          </h3>
        </div>

        {assets.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-xl bg-card/40">
            <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-foreground">Belum ada gambar yang dihasilkan</p>
            <p className="text-xs text-muted-foreground mt-1">
              Gunakan form di atas untuk menghasilkan thumbnail atau scene visual pertama Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {assets.map((asset) => {
              const meta = (asset.metadata as Record<string, unknown>) || {};
              const assetAspect = (meta.aspectRatio as string) || "9:16";
              const assetStyle = (meta.style as string) || "cinematic";

              return (
                <Card
                  key={asset.id}
                  className="group relative overflow-hidden border-border bg-card shadow-sm hover:shadow-md transition-all flex flex-col"
                >
                  <div
                    className="relative w-full bg-muted/40 cursor-pointer overflow-hidden flex items-center justify-center aspect-[9/16]"
                    onClick={() => setPreviewAsset(asset)}
                  >
                    {/* Real Image Render */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.public_url}
                      alt={asset.title}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full">
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="absolute top-2 left-2 flex gap-1">
                      <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm">
                        {assetAspect}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-background/80 backdrop-blur-sm">
                        {asset.asset_type}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-3 flex-1 flex flex-col justify-between">
                    <p className="text-xs font-medium text-foreground line-clamp-2" title={asset.title}>
                      {asset.title}
                    </p>

                    <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/40 mt-2">
                      <a
                        href={asset.public_url}
                        download={`image_${asset.id}.png`}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        title="Unduh PNG Asli"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Unduh
                      </a>

                      <button
                        type="button"
                        onClick={() => handleVariation(asset)}
                        disabled={isGenerating}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        title="Buat Variasi"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Variasi
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal Dialog */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                {previewAsset.title}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setPreviewAsset(null)}>
                ✕
              </Button>
            </div>

            <div className="p-4 flex-1 overflow-auto flex flex-col items-center justify-center bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewAsset.public_url}
                alt={previewAsset.title}
                className="max-h-[60vh] max-w-full rounded-lg shadow-md object-contain"
              />
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                <span>Ukuran: {(previewAsset.file_size_bytes / 1024).toFixed(1)} KB</span>
                <span className="mx-2">•</span>
                <span>Format: {previewAsset.mime_type}</span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewAsset.public_url}
                  download={`image_${previewAsset.id}.png`}
                >
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                    <Download className="h-4 w-4" />
                    Unduh Gambar
                  </Button>
                </a>

                <Link href="/studio/timeline">
                  <Button size="sm" className="gap-1.5 text-xs">
                    <Film className="h-4 w-4" />
                    Gunakan di Timeline
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
