"use client";

import * as React from "react";
import { Gauge, Coins, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  CreatorAssessment,
  MonetizationRecommendationItem,
} from "@/lib/validation/creator-intelligence-schemas";

interface AssessmentAndMonetizationPanelProps {
  assessment: CreatorAssessment | null;
  monetization: MonetizationRecommendationItem[];
}

const READINESS_LABELS: Record<CreatorAssessment["readinessLevel"], string> = {
  foundation_building: "Tahap Membangun Fondasi",
  ready_to_launch: "Siap Meluncurkan Konten Rutin",
  ready_to_scale: "Siap Ekspansi & Optimasi",
};

const STAGE_LABELS: Record<
  MonetizationRecommendationItem["readinessStage"],
  string
> = {
  mulai_sekarang: "Bisa Disiapkan Sekarang",
  setelah_konsisten_30_hari: "Setelah Konsisten 30 Hari",
  jangka_menengah: "Jangka Menengah (3–6 Bulan)",
};

export function AssessmentAndMonetizationPanel({
  assessment,
  monetization,
}: AssessmentAndMonetizationPanelProps) {
  if (!assessment && monetization.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Gauge}
            title="Evaluasi & Rekomendasi Monetisasi Belum Tersedia"
            description="Selesaikan wawancara onboarding dan jalankan Sintesis Creator Intelligence untuk memetakan skor kesiapan serta jalur monetisasi realistis Anda."
            className="p-8"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Creator Readiness Assessment */}
      {assessment && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Creator Readiness Assessment
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                {READINESS_LABELS[assessment.readinessLevel]}
              </Badge>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              {assessment.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-xs">
            <div className="grid gap-3 md:grid-cols-2">
              {assessment.dimensions.map((dim) => (
                <div
                  key={dim.dimension}
                  className="rounded-lg border border-border/70 bg-card/50 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{dim.dimension}</span>
                    <span className="text-primary">{dim.score}/10</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, dim.score * 10)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{dim.rationale}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Kekuatan Utama Anda</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  {assessment.topStrengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Bottleneck yang Perlu Dijaga</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  {assessment.keyBottlenecks.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <span className="font-semibold text-primary">Fokus Prioritas: </span>
              <span>{assessment.recommendedFocus}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Realistic Monetization Pathways */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Rekomendasi Jalur Monetisasi Realistis
            </CardTitle>
          </div>
          <CardDescription className="text-xs flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>
              Prinsip Transparansi CreatorOS AI: Rekomendasi ini memetakan kecocokan model bisnis tanpa pernah menjanjikan nominal pendapatan pasti atau viralitas instan.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 text-xs">
          {monetization.map((item) => (
            <div
              key={item.pathwayName}
              className="rounded-lg border border-border bg-card p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm text-foreground">
                    {item.pathwayName}
                  </h4>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {STAGE_LABELS[item.readinessStage]}
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {item.fitExplanation}
                </p>
                <div>
                  <span className="font-semibold text-foreground block mb-1">
                    Prasyarat Kesiapan:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
                    {item.prerequisites.map((pre) => (
                      <li key={pre}>{pre}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="text-[11px]">
                  <span className="font-semibold text-primary">Langkah Awal: </span>
                  {item.firstActionStep}
                </p>
                <p className="text-[10px] italic text-muted-foreground">
                  Catatan Realistis: {item.realisticDisclaimer}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
