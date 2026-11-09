"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Compass,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Dna,
  Target,
  Layers,
  Coins,
  FileSearch,
} from "lucide-react";
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
  generateNicheRecommendationsAction,
  selectPreferredNicheAction,
} from "@/features/niche-discovery/actions";
import type {
  SelectedNicheSummary,
  WorkspaceCreatorContext,
} from "@/lib/ai/context-builder";

interface NicheDiscoveryWorkspaceProps {
  context: WorkspaceCreatorContext;
  initialRecommendations: SelectedNicheSummary[];
  canEdit: boolean;
  aiConfigured: boolean;
  creditBalance: number;
}

const DENSITY_LABELS = {
  low: { label: "Kompetisi Rendah", variant: "success" as const },
  moderate: { label: "Kompetisi Menengah", variant: "warning" as const },
  high: { label: "Kompetisi Padat", variant: "destructive" as const },
};

const CONFIDENCE_LABELS = {
  high: "Keyakinan Tinggi",
  medium: "Keyakinan Menengah",
  exploratory: "Eksploratif",
};

export function NicheDiscoveryWorkspace({
  context,
  initialRecommendations,
  canEdit,
  aiConfigured,
  creditBalance,
}: NicheDiscoveryWorkspaceProps) {
  const [recommendations, setRecommendations] = React.useState<
    SelectedNicheSummary[]
  >(initialRecommendations);
  const [focusHint, setFocusHint] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [selectingId, setSelectingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRecommendations(initialRecommendations);
  }, [initialRecommendations]);

  const hasReusableContext = Boolean(context.coreAnswers || context.creatorDna);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setIsGenerating(true);
    try {
      const res = await generateNicheRecommendationsAction(
        context.workspaceId,
        focusHint
      );
      if (res.success) {
        setRecommendations(res.recommendations);
        toast.success(
          `${res.recommendations.length} rekomendasi niche terstruktur berhasil dibuat! (Sisa ${res.remainingCredits} kredit)`
        );
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectNiche = async (nicheId: string) => {
    if (!canEdit) return;
    setSelectingId(nicheId);
    try {
      const res = await selectPreferredNicheAction(context.workspaceId, nicheId);
      if (res.success) {
        setRecommendations((prev) =>
          prev.map((item) => ({
            ...item,
            isSelected: item.id === nicheId,
          }))
        );
        toast.success(
          `Niche utama diperbarui ke "${res.selectedNicheTitle}" dan disinkronkan ke Creator DNA!`
        );
      } else {
        toast.error(res.error);
      }
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Reusable AI Context Banner (Acceptance Criterion #7) */}
      <Card className="border-primary/20 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Konteks Creator Intelligence Aktif (Reusable Context)
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Saldo: {creditBalance} Kredit
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {hasReusableContext ? (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>
                Mode:{" "}
                <strong className="text-foreground capitalize">
                  {context.creatorMode.replace("_", " ")}
                </strong>
              </span>
              <span>•</span>
              <span>
                Niche Saat Ini:{" "}
                <strong className="text-foreground">
                  {context.creatorDna?.primaryNiche ??
                    context.selectedNiche?.nicheTitle ??
                    "Belum dipilih"}
                </strong>
              </span>
              {context.coreAnswers && (
                <>
                  <span>•</span>
                  <span>
                    Minat:{" "}
                    <strong className="text-foreground">
                      {context.coreAnswers.interests.slice(0, 3).join(", ")}
                    </strong>
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
              <span>
                Lengkapi wawancara onboarding atau Creator DNA terlebih dahulu agar rekomendasi niche dipersonalisasi sesuai kapasitas Anda.
              </span>
              <Link href="/creator-profile">
                <Button size="sm" variant="outline" className="text-xs">
                  Isi Onboarding Kreator
                </Button>
              </Link>
            </div>
          )}

          {!aiConfigured && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <code>GEMINI_API_KEY</code> atau <code>OPENAI_API_KEY</code> belum diatur pada <code>.env.local</code>. Tambahkan API key yang valid untuk menghasilkan kandidat niche baru melalui AI.
              </span>
            </div>
          )}

          {canEdit && hasReusableContext && (
            <form
              onSubmit={handleGenerate}
              className="flex flex-col sm:flex-row gap-2.5 pt-2"
            >
              <Input
                value={focusHint}
                onChange={(e) => setFocusHint(e.target.value)}
                placeholder="Opsional: arahkan fokus spesifik (mis. 'fokus audiens ibu bekerja' atau 'tanpa tampil wajah')"
                className="flex-1 text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!aiConfigured}
                isLoading={isGenerating}
                className="gap-1.5 shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Analisis Niche (2 Kredit)</span>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Niche Recommendations List */}
      {recommendations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Compass}
              title="Belum Ada Rekomendasi Niche Tersimpan"
              description="Klik 'Analisis Niche (2 Kredit)' di atas untuk menghasilkan kandidat niche lengkap dengan evaluasi audiens, peluang konten, tingkat kompetisi, keahlian, monetisasi realistis, dan bukti pendukung."
              className="p-10"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {recommendations.map((rec) => {
            const densityMeta =
              DENSITY_LABELS[rec.competitionAssessment.competitionDensity];
            return (
              <Card
                key={rec.id}
                className={
                  rec.isSelected
                    ? "border-primary ring-1 ring-primary/30 bg-primary/[0.02]"
                    : "border-border"
                }
              >
                <CardHeader className="pb-3 border-b border-border/60">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base font-bold text-foreground">
                          {rec.nicheTitle}
                        </CardTitle>
                        {rec.isSelected && (
                          <Badge variant="success" className="gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Niche Pilihan Utama
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs leading-relaxed">
                        {rec.explanation}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Badge variant={densityMeta.variant} className="text-[10px]">
                        {densityMeta.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {CONFIDENCE_LABELS[rec.confidenceLevel]} ({rec.confidenceScore}/100)
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 text-xs">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Audience & Skills */}
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border/70 p-3 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Target className="h-3.5 w-3.5 text-primary" />
                          <span>Segmen Target Audiens</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          {rec.audience}
                        </p>
                      </div>

                      <div className="rounded-lg border border-border/70 p-3 space-y-1.5">
                        <span className="font-semibold text-foreground block">
                          Keahlian yang Dibutuhkan
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.requiredSkills.map((sk) => (
                            <Badge key={sk} variant="secondary" className="text-[10px]">
                              {sk}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Competition Assessment */}
                    <div className="rounded-lg border border-border/70 p-3 space-y-2">
                      <span className="font-semibold text-foreground block">
                        Evaluasi Kompetisi & Diferensiasi
                      </span>
                      <p className="text-muted-foreground">
                        <strong>Strategi Pembeda:</strong>{" "}
                        {rec.competitionAssessment.differentiationStrategy}
                      </p>
                      <p className="text-muted-foreground">
                        <strong>Hambatan Masuk:</strong>{" "}
                        {rec.competitionAssessment.entryBarrierSummary}
                      </p>
                      <p className="text-[11px] italic text-muted-foreground/80">
                        Metodologi: {rec.competitionAssessment.assessmentMethodology}
                      </p>
                    </div>
                  </div>

                  {/* Content Opportunities */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>Peluang Sudut Konten Konkret</span>
                    </div>
                    <div className="grid gap-2.5 md:grid-cols-3">
                      {rec.contentOpportunities.map((opp) => (
                        <div
                          key={opp.angleTitle}
                          className="rounded-md border border-border/60 bg-card/50 p-2.5 space-y-1"
                        >
                          <div className="font-semibold text-foreground">
                            {opp.angleTitle}
                          </div>
                          <div className="text-[10px] text-primary font-medium">
                            Format: {opp.formatSuggestion}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {opp.whyAudienceCares}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Monetization & Supporting Evidence */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border/70 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Coins className="h-3.5 w-3.5 text-primary" />
                        <span>Kemungkinan Jalur Monetisasi (Tanpa Janji Pendapatan)</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                        {rec.monetizationPossibilities.map((m) => (
                          <li key={m.channel}>
                            <strong className="text-foreground">{m.channel}:</strong>{" "}
                            {m.prerequisiteNote}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg border border-border/70 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <FileSearch className="h-3.5 w-3.5 text-primary" />
                        <span>Bukti Pendukung & Batasan Data</span>
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                        {rec.supportingEvidence.profileFitSignals.map((sig) => (
                          <li key={sig}>{sig}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-muted-foreground">
                        {rec.supportingEvidence.marketObservationNote}
                      </p>
                      <p className="text-[10px] italic text-muted-foreground/80 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3 shrink-0" />
                        <span>{rec.supportingEvidence.dataAvailabilityStatus}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>

                {canEdit && (
                  <CardFooter className="border-t border-border/60 pt-3 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant={rec.isSelected ? "secondary" : "default"}
                      disabled={rec.isSelected}
                      isLoading={selectingId === rec.id}
                      onClick={() => handleSelectNiche(rec.id)}
                      className="gap-1.5 text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {rec.isSelected
                          ? "Terpilih sebagai Niche Utama"
                          : "Pilih sebagai Niche Utama"}
                      </span>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
