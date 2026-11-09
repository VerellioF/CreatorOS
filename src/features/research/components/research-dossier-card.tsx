"use client";

import * as React from "react";
import {
  ExternalLink,
  Clock,
  ShieldCheck,
  BrainCircuit,
  AlertTriangle,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { HydratedResearchReport } from "@/services/research-service";

interface ResearchDossierCardProps {
  report: HydratedResearchReport;
}

const CONFIDENCE_BADGE = {
  high: { label: "Confidence: Tinggi", variant: "success" as const },
  medium: { label: "Confidence: Menengah", variant: "warning" as const },
  low: { label: "Confidence: Rendah", variant: "secondary" as const },
};

const TYPE_LABELS = {
  trend: "Trend Research",
  competitor: "Competitor Research",
  audience: "Audience Research",
};

export function ResearchDossierCard({ report }: ResearchDossierCardProps) {
  const conf = CONFIDENCE_BADGE[report.overallConfidence];
  const formattedRetrievedAt = new Date(report.retrievedAt).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm">
      <CardHeader className="space-y-3 border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-semibold">
              {TYPE_LABELS[report.reportType]}
            </Badge>
            <Badge variant="secondary" className="uppercase text-[10px]">
              {report.targetPlatform}
            </Badge>
            <Badge variant={conf.variant}>{conf.label}</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Diambil: {formattedRetrievedAt}</span>
          </div>
        </div>

        <div>
          <CardTitle className="text-lg font-bold">{report.title}</CardTitle>
          <CardDescription className="text-xs mt-1">
            Kueri Riset: <span className="font-medium text-foreground">{report.topicQuery}</span>
          </CardDescription>
        </div>

        {report.realtimeDataAvailable ? (
          <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Data Web Publik Terverifikasi:</strong> Laporan ini memuat{" "}
              {report.sources.length} sumber tercatat dengan timestamp pengambilan nyata.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>Status Data Real-Time Tidak Tersedia:</strong>{" "}
              {report.realtimeUnavailableReason}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6 pt-5 text-sm">
        {/* Executive Summary */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Ringkasan Eksekutif
          </h4>
          <p className="text-sm leading-relaxed text-foreground/90">{report.summary}</p>
        </div>

        {/* Strict Separation: Verified Facts vs AI Interpretations */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>FAKTA TERVERIFIKASI SUMBER ({report.verifiedFacts.length})</span>
            </div>
            {report.verifiedFacts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Belum ada data fakta kuantitatif/berita eksternal terverifikasi untuk kueri ini; lihat interpretasi strategis AI di samping.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {report.verifiedFacts.map((vf, idx) => (
                  <li key={idx} className="text-xs space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <p className="font-medium text-foreground">{vf.fact}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vf.sourceUrls.map((u, uIdx) => (
                        <a
                          key={uIdx}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Link2 className="h-3 w-3" />
                          <span>Sumber #{uIdx + 1}</span>
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <BrainCircuit className="h-4 w-4" />
              <span>INTERPRETASI STRATEGIS AI ({report.aiInterpretations.length})</span>
            </div>
            <ul className="space-y-2.5">
              {report.aiInterpretations.map((interp, idx) => (
                <li key={idx} className="text-xs space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <p className="font-medium text-foreground">{interp.interpretation}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Dasar penalaran: {interp.reasoningBasis} ({interp.confidence})
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Traceable Trend Claims */}
        {report.trendClaims.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Klaim Tren & Ketertelusuran Bukti
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              {report.trendClaims.map((tc, idx) => (
                <div key={idx} className="rounded-lg border border-border/70 bg-background/60 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={
                        tc.evidenceStatus === "verified_by_sources" ? "success" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {tc.evidenceStatus === "verified_by_sources"
                        ? "Terbukti Sumber"
                        : "Pola Kualitatif"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      Confidence: {tc.confidenceLevel}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{tc.claim}</p>
                  <p className="text-muted-foreground">{tc.directionOrPattern}</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Limitasi: {tc.dataLimitation}
                  </p>
                  {tc.supportingSourceUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {tc.supportingSourceUrls.map((url, uIdx) => (
                        <a
                          key={uIdx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Rujukan #{uIdx + 1}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audience & Competitor Insights */}
        <div className="grid gap-4 md:grid-cols-2">
          {report.audienceInsights.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Temuan Perilaku Audiens
              </h4>
              <div className="space-y-2">
                {report.audienceInsights.map((ai, idx) => (
                  <div key={idx} className="rounded-md border border-border/60 p-2.5 text-xs space-y-1">
                    <p className="font-semibold">{ai.segmentPainOrDesire}</p>
                    <p className="text-muted-foreground">{ai.contentBehaviorNote}</p>
                    <p className="text-[10px] text-muted-foreground/80">Bukti: {ai.evidenceBasis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.actionableRecommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rekomendasi Eksekusi Konten
              </h4>
              <ul className="space-y-1.5 rounded-md border border-border/60 p-3 text-xs list-disc pl-6">
                {report.actionableRecommendations.map((rec, idx) => (
                  <li key={idx} className="text-foreground/90">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recorded Sources Ledger (All 6 Mandatory Fields) */}
        <div className="space-y-2.5 pt-2 border-t border-border/60">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Daftar Sumber Tercatat ({report.sources.length})
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Keterbatasan Laporan: {report.dataLimitations}
            </span>
          </div>

          {report.sources.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Tidak ada URL sumber eksternal yang tercatat pada sesi ini. Tambahkan URL referensi publik atau aktifkan koneksi web untuk sitasi langsung.
            </p>
          ) : (
            <div className="space-y-2.5">
              {report.sources.map((src, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={src.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>{src.sourceTitle}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        Confidence: {src.confidenceLevel}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(src.retrievedAt).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground break-all">{src.sourceUrl}</p>
                  <p className="text-foreground/90">
                    <strong>Informasi Terekstrak:</strong> {src.relevantExtract}
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Keterbatasan Data:</strong> {src.dataLimitations} |{" "}
                    <strong>Alasan Keyakinan:</strong> {src.confidenceRationale}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
