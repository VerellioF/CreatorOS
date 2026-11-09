"use client";

import * as React from "react";
import { toast } from "sonner";
import { Target, Sparkles, Coins, Save, Plus, Gauge } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  ensureManualStrategyAction,
  generateContentStrategyAction,
  updateStrategyOverviewAction,
} from "@/features/strategy/actions";
import { BrandContextCard } from "./brand-context-card";
import { PillarEditorPanel } from "./pillar-editor-panel";
import type { HydratedContentStrategy } from "@/services/strategy-service";
import type { HydratedResearchReport } from "@/services/research-service";
import type { BrandProfileInput } from "@/lib/validation/strategy-and-content-schemas";

interface StrategyWorkspaceProps {
  workspaceId: string;
  workspaceName: string;
  initialBrand: BrandProfileInput | null;
  initialStrategy: HydratedContentStrategy | null;
  researchReports: HydratedResearchReport[];
  canEdit: boolean;
  aiConfigured: boolean;
  creditBalance: number;
}

export function StrategyWorkspace({
  workspaceId,
  workspaceName,
  initialBrand,
  initialStrategy,
  researchReports,
  canEdit,
  aiConfigured,
  creditBalance,
}: StrategyWorkspaceProps) {
  const [strategy, setStrategy] = React.useState<HydratedContentStrategy | null>(
    initialStrategy
  );
  const [credits, setCredits] = React.useState(creditBalance);
  const [selectedReportId, setSelectedReportId] = React.useState<string>(
    researchReports[0]?.id ?? ""
  );
  const [weeklyCadence, setWeeklyCadence] = React.useState(
    initialStrategy?.publishingFrequencyPerWeek ?? 4
  );
  const [focusNotes, setFocusNotes] = React.useState("");

  // Editable overview fields
  const [title, setTitle] = React.useState(initialStrategy?.title ?? "");
  const [positioning, setPositioning] = React.useState(
    initialStrategy?.positioningStatement ?? ""
  );
  const [differentiator, setDifferentiator] = React.useState(
    initialStrategy?.uniqueDifferentiator ?? ""
  );
  const [narrative, setNarrative] = React.useState(
    initialStrategy?.coreNarrative ?? ""
  );
  const [isPending, startTransition] = React.useTransition();

  const syncFormFromStrategy = (next: HydratedContentStrategy) => {
    setStrategy(next);
    setTitle(next.title);
    setPositioning(next.positioningStatement);
    setDifferentiator(next.uniqueDifferentiator);
    setNarrative(next.coreNarrative);
    setWeeklyCadence(next.publishingFrequencyPerWeek);
  };

  const handleGenerateAiStrategy = () => {
    startTransition(async () => {
      const res = await generateContentStrategyAction(workspaceId, {
        researchReportId: selectedReportId || null,
        customFocusNotes: focusNotes.trim() || undefined,
        weeklyCadence,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      syncFormFromStrategy(res.strategy);
      setCredits(res.remainingCredits);
      toast.success("Content Strategy, Opportunity Scoring & Pilar berhasil disusun.");
    });
  };

  const handleInitManual = () => {
    startTransition(async () => {
      const res = await ensureManualStrategyAction(workspaceId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      syncFormFromStrategy(res.strategy);
      toast.success("Kerangka strategi manual siap diedit.");
    });
  };

  const handleSaveOverview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strategy) return;

    startTransition(async () => {
      const res = await updateStrategyOverviewAction(workspaceId, {
        strategyId: strategy.id,
        title,
        positioningStatement: positioning,
        uniqueDifferentiator: differentiator,
        coreNarrative: narrative,
        publishingFrequencyPerWeek: weeklyCadence,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setStrategy((prev) =>
        prev
          ? {
              ...prev,
              title,
              positioningStatement: positioning,
              uniqueDifferentiator: differentiator,
              coreNarrative: narrative,
              publishingFrequencyPerWeek: weeklyCadence,
            }
          : null
      );
      toast.success("Content Positioning & Strategi diperbarui.");
    });
  };

  return (
    <div className="space-y-6">
      <BrandContextCard
        workspaceId={workspaceId}
        defaultName={workspaceName}
        initialBrand={initialBrand}
        canEdit={canEdit}
      />

      {/* AI Strategy Synthesis Trigger */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Penyusun Strategi, Positioning & Opportunity Scoring AI
            </CardTitle>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span>Biaya: 3 Kredit (Saldo: {credits})</span>
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Menggabungkan Creator DNA, Brand Context, Niche Terpilih, dan Dossier Riset menjadi positioning tajam, skor peluang, serta pilar konten.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-medium">Rujukan Dossier Riset</label>
            <select
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
              <option value="">Tanpa laporan spesifik (gunakan Creator DNA)</option>
              {researchReports.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.reportType.toUpperCase()}] {r.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Target Konten / Minggu</label>
            <Input
              type="number"
              min={1}
              max={21}
              value={weeklyCadence}
              onChange={(e) => setWeeklyCadence(Number(e.target.value))}
              className="bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Fokus Kampanye (Opsional)</label>
            <Input
              value={focusNotes}
              onChange={(e) => setFocusNotes(e.target.value)}
              placeholder="Contoh: Fokus edukasi pemula"
              className="bg-background"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-3">
          {!strategy && canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInitManual}
              disabled={isPending}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Buat Kerangka Strategi Manual</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleGenerateAiStrategy}
            disabled={!canEdit || !aiConfigured || isPending}
            className="gap-1.5 ml-auto"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isPending ? "Menyusun Strategi..." : "Susun Strategi Konten AI (3 Kredit)"}
            </span>
          </Button>
        </CardFooter>
      </Card>

      {!strategy ? (
        <EmptyState
          icon={Target}
          title="Belum Ada Strategi Konten Aktif"
          description="Susun strategi otomatis dengan AI atau klik 'Buat Kerangka Strategi Manual' untuk merancang positioning dan pilar konten sendiri."
        />
      ) : (
        <>
          {/* Editable Strategy Positioning & Narrative */}
          <Card className="border-border/80">
            <form onSubmit={handleSaveOverview}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Content Positioning & Core Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-medium">Judul Strategi</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={!canEdit || isPending}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Frekuensi / Minggu</label>
                    <Input
                      type="number"
                      min={1}
                      max={21}
                      value={weeklyCadence}
                      onChange={(e) => setWeeklyCadence(Number(e.target.value))}
                      disabled={!canEdit || isPending}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Content Positioning Statement</label>
                  <textarea
                    rows={2}
                    value={positioning}
                    onChange={(e) => setPositioning(e.target.value)}
                    disabled={!canEdit || isPending}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Unique Differentiator</label>
                    <textarea
                      rows={2}
                      value={differentiator}
                      onChange={(e) => setDifferentiator(e.target.value)}
                      disabled={!canEdit || isPending}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Core Narrative</label>
                    <textarea
                      rows={2}
                      value={narrative}
                      onChange={(e) => setNarrative(e.target.value)}
                      disabled={!canEdit || isPending}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </CardContent>
              {canEdit && (
                <CardFooter className="justify-end border-t border-border/60 pt-3">
                  <Button type="submit" size="sm" variant="outline" disabled={isPending} className="gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    <span>Simpan Positioning</span>
                  </Button>
                </CardFooter>
              )}
            </form>
          </Card>

          {/* Editable Content Pillars */}
          <PillarEditorPanel
            workspaceId={workspaceId}
            strategyId={strategy.id}
            pillars={strategy.pillars}
            canEdit={canEdit}
            onPillarsChange={(nextPillars) =>
              setStrategy((prev) => (prev ? { ...prev, pillars: nextPillars } : null))
            }
          />

          {/* Opportunity Scoring Matrix */}
          {strategy.opportunityScores.length > 0 && (
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Opportunity Scoring Matrix</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Evaluasi peluang sudut topik berdasarkan kecocokan kreator, kepadatan kompetisi, dan rujukan bukti.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {strategy.opportunityScores.map((opp, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/70 p-3.5 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">{opp.topicOrAngle}</span>
                      <Badge variant="success">Skor: {opp.opportunityScore}/100</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>Platform: {opp.targetPlatform.toUpperCase()}</span>
                      <span>•</span>
                      <span>Creator Fit: {opp.creatorFitScore}/100</span>
                      <span>•</span>
                      <span>Kompetisi: {opp.competitionDensity}</span>
                    </div>
                    <p>{opp.scoringRationale}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Rujukan: {opp.evidenceSourceNote}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
