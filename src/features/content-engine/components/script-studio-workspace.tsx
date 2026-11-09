"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, Sparkles, Plus, Coins } from "lucide-react";
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
import { generateContentPackageAction } from "@/features/content-engine/actions";
import { ContentPackageEditor } from "./content-package-editor";
import type {
  HydratedContentIdea,
  HydratedContentPackage,
} from "@/services/content-engine-service";
import type { HydratedContentPillar } from "@/services/strategy-service";
import type { HydratedResearchReport } from "@/services/research-service";
import type { ScriptFramework, SocialPlatformId } from "@/lib/supabase/types";

interface ScriptStudioWorkspaceProps {
  workspaceId: string;
  initialPackages: HydratedContentPackage[];
  ideas: HydratedContentIdea[];
  pillars: HydratedContentPillar[];
  reports: HydratedResearchReport[];
  preselectedIdeaId?: string;
  canEdit: boolean;
  aiConfigured: boolean;
  creditBalance: number;
}

export function ScriptStudioWorkspace({
  workspaceId,
  initialPackages,
  ideas,
  pillars,
  reports,
  preselectedIdeaId,
  canEdit,
  aiConfigured,
  creditBalance,
}: ScriptStudioWorkspaceProps) {
  const preIdea = preselectedIdeaId
    ? ideas.find((i) => i.id === preselectedIdeaId)
    : undefined;

  const [packages, setPackages] = React.useState(initialPackages);
  const [selectedPkgId, setSelectedPkgId] = React.useState<string | null>(
    initialPackages[0]?.id ?? null
  );
  const [credits, setCredits] = React.useState(creditBalance);

  // Generator controls
  const [ideaId, setIdeaId] = React.useState<string>(preIdea?.id ?? "");
  const [topicOrBrief, setTopicOrBrief] = React.useState(
    preIdea ? `${preIdea.title} — ${preIdea.hookConcept}` : ""
  );
  const [targetPlatform, setTargetPlatform] = React.useState<SocialPlatformId>(
    preIdea?.targetPlatform ?? "tiktok"
  );
  const [framework, setFramework] = React.useState<ScriptFramework>("PAS");
  const [targetDuration, setTargetDuration] = React.useState(45);
  const [pillarId, setPillarId] = React.useState<string>(preIdea?.pillarId ?? "");
  const [reportId, setReportId] = React.useState<string>(
    preIdea?.researchReportId ?? reports[0]?.id ?? ""
  );
  const [isPending, startTransition] = React.useTransition();

  const selectedPkg = packages.find((p) => p.id === selectedPkgId) ?? null;

  const handleIdeaChange = (nextIdeaId: string) => {
    setIdeaId(nextIdeaId);
    const found = ideas.find((i) => i.id === nextIdeaId);
    if (found) {
      setTopicOrBrief(`${found.title} — Hook: ${found.hookConcept}`);
      setTargetPlatform(found.targetPlatform);
      if (found.pillarId) setPillarId(found.pillarId);
      if (found.researchReportId) setReportId(found.researchReportId);
    }
  };

  const handleGeneratePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicOrBrief.trim()) {
      toast.error("Masukkan brief topik atau pilih ide dari backlog.");
      return;
    }

    startTransition(async () => {
      const res = await generateContentPackageAction(workspaceId, {
        topicOrBrief: topicOrBrief.trim(),
        targetPlatform,
        framework,
        targetDurationSeconds: targetDuration,
        pillarId: pillarId || null,
        ideaId: ideaId || null,
        researchReportId: reportId || null,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setPackages((prev) => [res.contentPackage, ...prev]);
      setSelectedPkgId(res.contentPackage.id);
      setCredits(res.remainingCredits);
      toast.success("Paket konten lengkap (Hook, Skrip, Caption, CTA, Hashtag) siap diedit!");
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <form onSubmit={handleGeneratePackage}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                Generator Paket Konten AI (Hook + Skrip + Caption + CTA + Hashtag)
              </CardTitle>
              <Badge variant="outline" className="gap-1.5 text-xs">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span>3 Kredit (Saldo: {credits})</span>
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Menggunakan Creator DNA, Brand Context, Niche, Persona, Aturan Platform, dan Bukti Riset.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Ambil dari Backlog Ide (Opsional)</label>
                <select
                  value={ideaId}
                  onChange={(e) => handleIdeaChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="">Tulis topik bebas...</option>
                  {ideas.map((i) => (
                    <option key={i.id} value={i.id}>
                      [{i.targetPlatform.toUpperCase()}] {i.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Pilar Konten</label>
                <select
                  value={pillarId}
                  onChange={(e) => setPillarId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="">Otomatis / Umum</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Rujukan Dossier Riset</label>
                <select
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="">Tanpa rujukan spesifik</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium">Brief / Topik Pembahasan</label>
                <Input
                  value={topicOrBrief}
                  onChange={(e) => setTopicOrBrief(e.target.value)}
                  placeholder="Jelaskan topik dan pesan inti konten..."
                  className="bg-background"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Platform Target</label>
                <select
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value as SocialPlatformId)}
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
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Framework</label>
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value as ScriptFramework)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="PAS">PAS</option>
                    <option value="AIDA">AIDA</option>
                    <option value="BAB">BAB</option>
                    <option value="Story">Story</option>
                    <option value="Listicle">Listicle</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Durasi (dtk)</label>
                  <Input
                    type="number"
                    min={15}
                    max={1800}
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(Number(e.target.value))}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-3">
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedPkgId(null)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tulis Naskah Manual Baru</span>
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!canEdit || !aiConfigured || isPending}
              className="gap-1.5 ml-auto"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {isPending ? "Menulis Skrip & Copy..." : "Hasilkan Paket Konten AI (3 Kredit)"}
              </span>
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Saved Content Items List */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Daftar Konten Tersimpan ({packages.length})
            </h3>
          </div>

          {packages.length === 0 ? (
            <Card className="border-dashed p-5 text-center text-xs text-muted-foreground">
              <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Belum ada konten tersimpan. Hasilkan dengan AI atau tulis manual di sebelah kanan.
            </Card>
          ) : (
            <div className="space-y-2">
              {packages.map((item) => {
                const active = item.id === selectedPkgId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPkgId(item.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors space-y-1.5 ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border/70 bg-card hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <Badge variant="secondary" className="uppercase text-[10px]">
                        {item.primaryPlatform}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {item.sourceContentItemId && (
                          <Badge variant="outline" className="text-[9px]">
                            Adapted
                          </Badge>
                        )}
                        {item.currentScript && (
                          <span className="text-[10px] text-muted-foreground">
                            v{item.currentScript.version}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs font-semibold line-clamp-2">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      Stage: {item.stage.replaceAll("_", " ")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Full Content Package & Platform Adaptation Editor */}
        <div className="lg:col-span-8">
          <ContentPackageEditor
            workspaceId={workspaceId}
            pkg={selectedPkg}
            canEdit={canEdit}
            aiConfigured={aiConfigured}
            onSaved={(updated) => {
              setPackages((prev) => {
                const exists = prev.some((p) => p.id === updated.id);
                return exists
                  ? prev.map((p) => (p.id === updated.id ? updated : p))
                  : [updated, ...prev];
              });
              setSelectedPkgId(updated.id);
            }}
            onAdapted={(adapted, remCredits) => {
              setPackages((prev) => [adapted, ...prev]);
              setSelectedPkgId(adapted.id);
              setCredits(remCredits);
            }}
          />
        </div>
      </div>
    </div>
  );
}
