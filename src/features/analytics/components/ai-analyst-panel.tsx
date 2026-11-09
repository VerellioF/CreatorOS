import * as React from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Target,
  ArrowRight,
  Loader2,
  CheckCircle2,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AIDiagnosticReport } from "@/lib/ai/schemas/analyst-deep-schemas";

interface AIAnalystPanelProps {
  report: AIDiagnosticReport | null;
  isLoading: boolean;
  onRunDiagnostics: () => void;
}

export function AIAnalystPanel({
  report,
  isLoading,
  onRunDiagnostics,
}: AIAnalystPanelProps) {
  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "A":
        return <Badge className="bg-emerald-500 text-white font-bold text-sm px-3 py-1">Grade A</Badge>;
      case "B":
        return <Badge className="bg-blue-500 text-white font-bold text-sm px-3 py-1">Grade B</Badge>;
      case "C":
        return <Badge className="bg-amber-500 text-white font-bold text-sm px-3 py-1">Grade C</Badge>;
      default:
        return <Badge className="bg-rose-500 text-white font-bold text-sm px-3 py-1">Grade D</Badge>;
    }
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">AI Performance Diagnostics & Retrospective</CardTitle>
                {report && getGradeBadge(report.performanceGrade)}
              </div>
              <CardDescription>
                Diagnosa konten terbaik vs terlemah, analisis pola retensi, dan rekomendasi berbasis bukti
              </CardDescription>
            </div>
          </div>

          <Button
            onClick={onRunDiagnostics}
            disabled={isLoading}
            className="gap-2 shrink-0 bg-gradient-to-r from-primary to-emerald-500 hover:opacity-90 text-primary-foreground"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menganalisis Data...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Jalankan AI Diagnostics (1 Kredit)</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!report ? (
          <div className="text-center py-12 border border-dashed rounded-lg border-border/60">
            <Lightbulb className="w-10 h-10 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold">Belum Ada Diagnosa Tersimpan</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              Klik tombol di atas untuk menjalankan analisis otomatis terhadap konten yang telah Anda publikasikan.
            </p>
          </div>
        ) : (
          <>
            {/* Executive Summary */}
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 text-sm leading-relaxed text-foreground">
              <p className="font-semibold text-xs text-primary uppercase tracking-wider mb-1">
                Executive Diagnostic Summary
              </p>
              {report.executiveSummary}
            </div>

            {/* Top vs Weak Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Performers */}
              <div className="space-y-3 p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4" />
                  <span>Konten Terbaik (Top Performers)</span>
                </div>
                {report.topPerformers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada konten dengan volume views memadai.</p>
                ) : (
                  <div className="space-y-2.5">
                    {report.topPerformers.map((top) => (
                      <div key={top.id} className="p-2.5 rounded bg-background/60 border border-emerald-500/20 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold line-clamp-1">{top.title}</span>
                          <span className="text-emerald-400 font-mono shrink-0 ml-2">{top.engagementRate}% ER</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{top.reasonForSuccess}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weak Performers */}
              <div className="space-y-3 p-4 rounded-lg border border-rose-500/30 bg-rose-500/5">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Konten Evaluasi (Weak Performers)</span>
                </div>
                {report.weakPerformers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Semua konten mencatatkan performa optimal.</p>
                ) : (
                  <div className="space-y-2.5">
                    {report.weakPerformers.map((weak) => (
                      <div key={weak.id} className="p-2.5 rounded bg-background/60 border border-rose-500/20 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold line-clamp-1">{weak.title}</span>
                          <span className="text-rose-400 font-mono shrink-0 ml-2">{weak.engagementRate}% ER</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug">{weak.diagnosticReason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Content Patterns & Audience Response */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-border/40 bg-background/40 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pola Konten Terbukti (Content Patterns)
                </h4>
                <div className="space-y-2">
                  {report.contentPatterns.map((pat, idx) => (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                        <span>{pat.pattern}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pl-5">{pat.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border/40 bg-background/40 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Respons Audiens & Retensi
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    Viral Ratio: {report.audienceResponse.viralPotentialRatio}%
                  </Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  <p className="text-muted-foreground leading-snug">
                    <strong className="text-foreground">Kedalaman Interaksi:</strong> {report.audienceResponse.engagementDepth}
                  </p>
                  <p className="text-muted-foreground leading-snug">
                    <strong className="text-foreground">Karakteristik Tonton:</strong> {report.audienceResponse.retentionSummary}
                  </p>
                </div>
              </div>
            </div>

            {/* Strategy Alignment */}
            <div className="p-4 rounded-lg border border-border/40 bg-background/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Keselarasan dengan Content Pillars Aktif
                  </h4>
                </div>
                <span className="text-xs font-bold font-mono text-primary">
                  Skor Keselarasan: {report.strategyAlignment.overallAlignmentScore}/100
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {report.strategyAlignment.pillarCoverage.map((p, idx) => (
                  <div key={idx} className="p-2.5 rounded border border-border/30 bg-muted/10 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold line-clamp-1">{p.pillarName}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          p.status === "optimal"
                            ? "text-emerald-400 border-emerald-500/30"
                            : "text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{p.postCount} postingan ({p.percentage}%)</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Traceable Recommendations */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rekomendasi Aksi Berbasis Bukti (Traceable Recommendations)
              </h4>
              <div className="space-y-3">
                {report.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-lg border border-border/50 bg-background/60 space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {rec.category}
                        </Badge>
                        <h5 className="font-bold text-sm text-foreground">{rec.action}</h5>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-400">{rec.expectedImpact}</span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.explanation}</p>

                    {/* Traceable Evidence Citing Exact Posts */}
                    <div className="p-2.5 rounded bg-muted/20 border border-border/30 space-y-1 text-xs">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Bukti Empiris Pelacak (Evidence):
                      </p>
                      {rec.evidence.map((ev, evIdx) => (
                        <div key={evIdx} className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-1">
                          <span className="font-medium text-foreground">
                            Post: &ldquo;{ev.contentTitle}&rdquo;
                          </span>
                          <span className="text-muted-foreground">
                            {ev.metricObserved} ({ev.benchmarkComparison})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
