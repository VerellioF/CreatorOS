"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save, Repeat, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { PLATFORM_RULES } from "@/lib/content/platform-rules";
import {
  adaptContentPlatformAction,
  saveEditableContentPackageAction,
} from "@/features/content-engine/actions";
import type { HydratedContentPackage } from "@/services/content-engine-service";
import type {
  ContentItemStage,
  ScriptFramework,
  SocialPlatformId,
} from "@/lib/supabase/types";

interface ContentPackageEditorProps {
  workspaceId: string;
  pkg: HydratedContentPackage | null;
  canEdit: boolean;
  aiConfigured: boolean;
  onSaved: (updated: HydratedContentPackage) => void;
  onAdapted: (adapted: HydratedContentPackage, remainingCredits: number) => void;
}

export function ContentPackageEditor({
  workspaceId,
  pkg,
  canEdit,
  aiConfigured,
  onSaved,
  onAdapted,
}: ContentPackageEditorProps) {
  const [title, setTitle] = React.useState(pkg?.title ?? "");
  const [primaryPlatform, setPrimaryPlatform] = React.useState<SocialPlatformId>(
    pkg?.primaryPlatform ?? "tiktok"
  );
  const [stage, setStage] = React.useState<ContentItemStage>(
    pkg?.stage ?? "scripting"
  );
  const [framework, setFramework] = React.useState<ScriptFramework>(
    pkg?.currentScript?.framework ?? "PAS"
  );
  const [durationSeconds, setDurationSeconds] = React.useState(
    pkg?.currentScript?.estimatedDurationSeconds ?? 45
  );
  const [openingHook, setOpeningHook] = React.useState(
    pkg?.currentScript?.openingHook ?? ""
  );
  const [bodyContent, setBodyContent] = React.useState(
    pkg?.currentScript?.bodyContent ?? ""
  );
  const [closingCta, setClosingCta] = React.useState(
    pkg?.currentScript?.closingCta ?? pkg?.callToAction ?? ""
  );
  const [caption, setCaption] = React.useState(pkg?.caption ?? "");
  const [hashtagsText, setHashtagsText] = React.useState(
    pkg?.hashtags.join(" ") ?? ""
  );
  const [saveAsNewVersion, setSaveAsNewVersion] = React.useState(false);
  const [adaptTarget, setAdaptTarget] = React.useState<SocialPlatformId>("linkedin");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setTitle(pkg?.title ?? "");
    setPrimaryPlatform(pkg?.primaryPlatform ?? "tiktok");
    setStage(pkg?.stage ?? "scripting");
    setFramework(pkg?.currentScript?.framework ?? "PAS");
    setDurationSeconds(pkg?.currentScript?.estimatedDurationSeconds ?? 45);
    setOpeningHook(pkg?.currentScript?.openingHook ?? "");
    setBodyContent(pkg?.currentScript?.bodyContent ?? "");
    setClosingCta(pkg?.currentScript?.closingCta ?? pkg?.callToAction ?? "");
    setCaption(pkg?.caption ?? "");
    setHashtagsText(pkg?.hashtags.join(" ") ?? "");
    setSaveAsNewVersion(false);
    if (pkg?.primaryPlatform === "linkedin") {
      setAdaptTarget("tiktok");
    } else {
      setAdaptTarget("linkedin");
    }
  }, [pkg]);

  const rule = PLATFORM_RULES[primaryPlatform];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const hashtags = hashtagsText
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);

    startTransition(async () => {
      const res = await saveEditableContentPackageAction(workspaceId, {
        contentItemId: pkg?.id,
        scriptId: pkg?.currentScript?.id,
        pillarId: pkg?.pillarId ?? null,
        ideaId: pkg?.ideaId ?? null,
        researchReportId: pkg?.researchReportId ?? null,
        title: title.trim(),
        primaryPlatform,
        contentFormat: pkg?.contentFormat ?? "short_video",
        stage,
        framework,
        openingHook: openingHook.trim(),
        hookVariants: pkg?.hookVariants ?? [],
        bodyContent: bodyContent.trim(),
        closingCta: closingCta.trim(),
        ctaVariants: pkg?.ctaVariants ?? [],
        visualAndAudioCues: pkg?.currentScript?.visualAndAudioCues ?? [],
        estimatedDurationSeconds: Number(durationSeconds),
        caption,
        hashtags,
        platformAdaptationNotes: pkg?.platformAdaptationNotes ?? "",
        saveAsNewScriptVersion: saveAsNewVersion,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      onSaved(res.contentPackage);
      setSaveAsNewVersion(false);
      toast.success("Paket konten & skrip berhasil disimpan.");
    });
  };

  const handleAdapt = () => {
    if (!pkg?.id) return;
    startTransition(async () => {
      const res = await adaptContentPlatformAction(workspaceId, {
        sourceContentItemId: pkg.id,
        targetPlatform: adaptTarget,
        targetFramework: framework,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      onAdapted(res.contentPackage, res.remainingCredits);
      toast.success(
        `Berhasil diadaptasi secara native ke ${PLATFORM_RULES[adaptTarget].label}!`
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Platform Adaptation Bar */}
      {pkg?.id && (
        <Card className="border-indigo-500/30 bg-indigo-500/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold flex items-center gap-1.5 text-foreground">
                <Repeat className="h-3.5 w-3.5 text-primary" />
                <span>Platform Adaptation Engine</span>
              </div>
              <p className="text-muted-foreground">
                Ubah hook, struktur skrip, batas karakter caption, CTA, dan hashtag secara native ke platform lain.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={adaptTarget}
                onChange={(e) => setAdaptTarget(e.target.value as SocialPlatformId)}
                className="flex h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                {(
                  ["tiktok", "instagram", "youtube", "linkedin", "threads", "x"] as const
                ).map((pf) => (
                  <option key={pf} value={pf}>
                    Ke {PLATFORM_RULES[pf].label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                onClick={handleAdapt}
                disabled={!canEdit || !aiConfigured || isPending}
                className="gap-1.5 h-8 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Adaptasi (2 Kredit)</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/80">
        <form onSubmit={handleSave}>
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {pkg ? "Editor Skrip, Hook, Caption & CTA" : "Tulis Paket Konten Baru"}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Aturan {rule.label}: {rule.hookWindowRule}
                </CardDescription>
              </div>
              {pkg?.currentScript && (
                <Badge variant="outline">
                  Skrip Versi v{pkg.currentScript.version} ({pkg.versionCount} total)
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium">Judul Konten</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Judul internal konten..."
                  disabled={!canEdit || isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Platform Utama</label>
                <select
                  value={primaryPlatform}
                  onChange={(e) => setPrimaryPlatform(e.target.value as SocialPlatformId)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="threads">Threads</option>
                  <option value="x">X</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Status Produksi</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as ContentItemStage)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="draft">Draft</option>
                  <option value="scripting">Scripting</option>
                  <option value="ready_for_production">Ready for Production</option>
                  <option value="ready_to_publish">Ready to Publish</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Framework Copywriting</label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value as ScriptFramework)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="PAS">PAS (Problem - Agitate - Solve)</option>
                  <option value="AIDA">AIDA (Attention - Interest - Desire - Action)</option>
                  <option value="BAB">BAB (Before - After - Bridge)</option>
                  <option value="Story">Storytelling</option>
                  <option value="Listicle">Structured Listicle</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Estimasi Durasi (detik — ideal {rule.optimalDurationSeconds.min}-
                  {rule.optimalDurationSeconds.max}s)
                </label>
                <Input
                  type="number"
                  min={5}
                  max={3600}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Hook Variants Quick Selector */}
            {pkg && pkg.hookVariants.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                <span className="text-xs font-semibold">
                  Alternatif Hook AI (klik untuk pakai sebagai Hook Utama):
                </span>
                <div className="space-y-1.5">
                  {pkg.hookVariants.map((hv, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setOpeningHook(hv.hookText)}
                      className="w-full text-left rounded border border-border/60 bg-background px-2.5 py-1.5 text-xs hover:border-primary transition-colors flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-primary">[{hv.style}]</span>{" "}
                        {hv.hookText}
                        <span className="block text-[11px] text-muted-foreground">
                          Visual: {hv.visualCue}
                        </span>
                      </div>
                      {openingHook === hv.hookText && (
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium">Opening Hook Utama</label>
              <textarea
                rows={2}
                value={openingHook}
                onChange={(e) => setOpeningHook(e.target.value)}
                disabled={!canEdit || isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Isi Naskah / Script Lengkap</label>
              <textarea
                rows={8}
                value={bodyContent}
                onChange={(e) => setBodyContent(e.target.value)}
                disabled={!canEdit || isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Call-To-Action (CTA) Penutup</label>
              <Input
                value={closingCta}
                onChange={(e) => setClosingCta(e.target.value)}
                disabled={!canEdit || isPending}
              />
              {pkg && pkg.ctaVariants.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {pkg.ctaVariants.map((cv, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setClosingCta(cv)}
                      className="rounded bg-muted px-2 py-0.5 text-[11px] hover:bg-primary/15"
                    >
                      Pakai: &ldquo;{cv}&rdquo;
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Caption Platform</label>
                <span className="text-[11px] text-muted-foreground">
                  {caption.length} / {rule.maxCaptionLength} karakter
                </span>
              </div>
              <textarea
                rows={4}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={!canEdit || isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">
                Hashtags (rekomendasi {rule.recommendedHashtagCount.min}-
                {rule.recommendedHashtagCount.max} tagar untuk {rule.label})
              </label>
              <Input
                value={hashtagsText}
                onChange={(e) => setHashtagsText(e.target.value)}
                placeholder="#produktivitas #kerjaremote #tipskarir"
                disabled={!canEdit || isPending}
              />
            </div>
          </CardContent>

          {canEdit && (
            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              {pkg?.currentScript ? (
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsNewVersion}
                    onChange={(e) => setSaveAsNewVersion(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span>Simpan sebagai versi skrip baru (v{pkg.currentScript.version + 1})</span>
                </label>
              ) : (
                <span />
              )}
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                <Save className="h-4 w-4" />
                <span>{isPending ? "Menyimpan..." : "Simpan Paket Konten"}</span>
              </Button>
            </CardFooter>
          )}
        </form>
      </Card>
    </div>
  );
}
