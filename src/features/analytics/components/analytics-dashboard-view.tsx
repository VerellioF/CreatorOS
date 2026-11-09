"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Plus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AnalyticsOverviewCard } from "@/features/analytics/components/analytics-overview-card";
import { PlatformComparisonChart } from "@/features/analytics/components/platform-comparison-chart";
import { ContentPerformanceTable } from "@/features/analytics/components/content-performance-table";
import { ManualEntryDialog } from "@/features/analytics/components/manual-entry-dialog";
import { AIAnalystPanel } from "@/features/analytics/components/ai-analyst-panel";
import type {
  WorkspaceAnalyticsOverview,
  AnalyticsDateRange,
  ContentPerformanceItem,
} from "@/lib/analytics/types";
import type { AIDiagnosticReport } from "@/lib/ai/schemas/analyst-deep-schemas";

export interface AnalyticsDashboardViewProps {
  workspaceId: string;
  userId: string;
}

export function AnalyticsDashboardView({ workspaceId, userId }: AnalyticsDashboardViewProps) {
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>("30d");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const [overview, setOverview] = useState<WorkspaceAnalyticsOverview | null>(null);
  const [contentItems, setContentItems] = useState<ContentPerformanceItem[]>([]);
  const [diagnosticReport, setDiagnosticReport] = useState<AIDiagnosticReport | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = `/api/workspace/analytics?workspaceId=${workspaceId}&dateRange=${dateRange}${
        platformFilter !== "all" ? `&platform=${platformFilter}` : ""
      }`;
      const res = await fetch(url);
      if (res.ok) {
        const data: WorkspaceAnalyticsOverview = await res.json();
        setOverview(data);
        const allItems = [...data.topPerformers, ...data.weakPerformers];
        const unique = Array.from(new Map(allItems.map((i) => [i.id, i])).values());
        setContentItems(unique);
      }

      // Fetch latest insight report
      const diagRes = await fetch(`/api/workspace/analytics/diagnostics?workspaceId=${workspaceId}`);
      if (diagRes.ok) {
        const diagData = await diagRes.json();
        if (diagData.insight) {
          const ins = diagData.insight;
          setDiagnosticReport({
            id: ins.id,
            workspaceId: ins.workspace_id,
            periodStart: ins.period_start,
            periodEnd: ins.period_end,
            performanceGrade: ins.performance_grade,
            executiveSummary: `Performa konten periode ${ins.period_start} s/d ${ins.period_end} memperoleh ${ins.performance_grade}.`,
            topPerformers: [],
            weakPerformers: [],
            contentPatterns: Array.isArray(ins.content_patterns) ? ins.content_patterns : [],
            audienceResponse: ins.audience_response || {
              engagementDepth: "Standar",
              viralPotentialRatio: 0,
              retentionSummary: "Stabil",
              sentimentThemes: [],
            },
            strategyAlignment: ins.strategy_alignment || {
              overallAlignmentScore: 85,
              pillarCoverage: [],
              misalignmentIssues: [],
            },
            recommendations: Array.isArray(ins.recommendations) ? ins.recommendations : [],
            modelId: ins.model_id || "gemini-1.5-flash",
            tokensUsed: ins.tokens_used || 0,
            costUsd: ins.cost_usd || 0,
            generatedAt: ins.created_at,
          });
        }
      }
    } catch {
      // offline / demo fallback
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, platformFilter, workspaceId]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleRunDiagnostics = async () => {
    try {
      setIsDiagnosing(true);
      const res = await fetch("/api/workspace/analytics/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Gagal menjalankan AI Diagnostics");
      }

      const json = await res.json();
      setDiagnosticReport(json.report);
      toast.success("AI Diagnostics & Rekomendasi Terlacak berhasil dihasilkan!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Analytics & Content Performance</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau metrik riil, bandingkan performa antar platform, dan dapatkan diagnosa AI berbasis bukti empiris.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="flex items-center rounded-lg border border-border/60 bg-background/50 p-0.5 text-xs">
            {(["7d", "30d", "90d", "all"] as AnalyticsDateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-colors ${
                  dateRange === r
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "all" ? "Semua" : `${r.replace("d", "")} Hari`}
              </button>
            ))}
          </div>

          {/* Add Manual Entry Button */}
          <Button
            onClick={() => setIsManualModalOpen(true)}
            variant="outline"
            className="gap-2 text-xs h-9"
          >
            <Plus className="w-4 h-4 text-primary" />
            <span>Catat Metrik Manual</span>
          </Button>

          {/* Refresh Data */}
          <Button
            onClick={() => fetchAnalyticsData()}
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Refresh Metrik"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading && !overview ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-7 h-7 animate-spin mr-3 text-primary" />
          <span className="text-sm font-medium">Memuat analitik performa terverifikasi...</span>
        </div>
      ) : overview ? (
        <div className="space-y-8">
          {/* Section 1: Core KPI Overview Cards */}
          <AnalyticsOverviewCard overview={overview} />

          {/* Section 2: AI Analyst Diagnostics Panel */}
          <AIAnalystPanel
            report={diagnosticReport}
            isLoading={isDiagnosing}
            onRunDiagnostics={handleRunDiagnostics}
          />

          {/* Section 3: Platform Comparison Grid */}
          <PlatformComparisonChart platforms={overview.platforms} />

          {/* Section 4: Content Performance Table */}
          <ContentPerformanceTable items={contentItems} />
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed rounded-lg border-border/60">
          <p className="text-sm text-muted-foreground">Belum ada data analitik untuk workspace ini.</p>
        </div>
      )}

      {/* Manual Entry Modal */}
      <ManualEntryDialog
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        workspaceId={workspaceId}
        onSuccess={() => fetchAnalyticsData()}
      />
    </div>
  );
}
