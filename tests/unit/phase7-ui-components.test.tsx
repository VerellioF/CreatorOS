import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalyticsOverviewCard } from "@/features/analytics/components/analytics-overview-card";
import { PlatformComparisonChart } from "@/features/analytics/components/platform-comparison-chart";
import { AIAnalystPanel } from "@/features/analytics/components/ai-analyst-panel";
import type { WorkspaceAnalyticsOverview } from "@/lib/analytics/types";
import type { AIDiagnosticReport } from "@/lib/ai/schemas/analyst-deep-schemas";

describe("Phase 7 UI — Analytics & AI Diagnostics Components", () => {
  const mockOverview: WorkspaceAnalyticsOverview = {
    workspaceId: "ws-1",
    dateRange: "30d",
    totalViews: 45000,
    totalEngagement: 5200,
    averageEngagementRate: 11.56,
    totalClicks: null, // Untracked
    totalConversions: null, // Untracked
    hasClickTracking: false,
    hasConversionTracking: false,
    connectedAccountsCount: 1,
    manualEntriesCount: 2,
    dataSourcesSummary: {
      connected: 1,
      manual: 2,
    },
    platforms: [
      {
        platform: "tiktok",
        totalViews: 30000,
        totalEngagement: 3800,
        averageEngagementRate: 12.67,
        postCount: 2,
        clicks: null,
        conversions: null,
        dataSource: "manual_entry",
      },
      {
        platform: "instagram",
        totalViews: 15000,
        totalEngagement: 1400,
        averageEngagementRate: 9.33,
        postCount: 1,
        clicks: null,
        conversions: null,
        dataSource: "connected_account",
      },
    ],
    history: [],
    topPerformers: [],
    weakPerformers: [],
  };

  it("renders AnalyticsOverviewCard and respects zero-fabrication of unavailable clicks", () => {
    render(<AnalyticsOverviewCard overview={mockOverview} />);

    expect(screen.getByText("45,000")).toBeInTheDocument();
    expect(screen.getByText("5,200")).toBeInTheDocument();
    expect(screen.getByText("11.56%")).toBeInTheDocument();

    // Zero fabrication check: clicks and conversions state "Belum ada data"
    const unavailables = screen.getAllByText("Belum ada data");
    expect(unavailables.length).toBeGreaterThanOrEqual(2);
  });

  it("renders PlatformComparisonChart with verified platform metrics", () => {
    render(<PlatformComparisonChart platforms={mockOverview.platforms} />);

    expect(screen.getByText("tiktok")).toBeInTheDocument();
    expect(screen.getByText("instagram")).toBeInTheDocument();
    expect(screen.getByText("30,000 views")).toBeInTheDocument();
    expect(screen.getByText("15,000 views")).toBeInTheDocument();
  });

  it("renders AIAnalystPanel with performance grade and traceable recommendations", () => {
    const mockReport: AIDiagnosticReport = {
      id: "report-1",
      workspaceId: "ws-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      performanceGrade: "A",
      executiveSummary: "Performa luar biasa bulan ini dengan keterlibatan tinggi.",
      topPerformers: [
        {
          id: "post-1",
          title: "Video Teratas",
          views: 30000,
          engagementRate: 14.5,
          reasonForSuccess: "Hook kuat dan rasio simpan tinggi.",
        },
      ],
      weakPerformers: [],
      contentPatterns: [
        {
          pattern: "Format Angka & Studi Kasus",
          confidence: "high",
          evidence: "Postingan angka menghasilkan 2.4x views.",
          samplePostTitles: ["Video Teratas"],
        },
      ],
      audienceResponse: {
        engagementDepth: "Tinggi",
        viralPotentialRatio: 4.5,
        retentionSummary: "Stabil",
        sentimentThemes: ["Tips praktis"],
      },
      strategyAlignment: {
        overallAlignmentScore: 92,
        pillarCoverage: [
          {
            pillarName: "Edukasi",
            postCount: 5,
            percentage: 60,
            status: "optimal",
          },
        ],
        misalignmentIssues: [],
      },
      recommendations: [
        {
          id: "rec-1",
          action: "Replikasi Formula Hook",
          category: "hook",
          explanation: "Hook ini terbukti melipatgandakan share.",
          evidence: [
            {
              contentId: "post-1",
              contentTitle: "Video Teratas",
              metricObserved: "30,000 views",
              benchmarkComparison: "+5.2% di atas rata-rata",
            },
          ],
          expectedImpact: "Kenaikan 30% views",
          applicablePillars: ["Edukasi"],
        },
      ],
      modelId: "gemini-1.5-flash",
      tokensUsed: 1200,
      costUsd: 0.0004,
      generatedAt: new Date().toISOString(),
    };

    render(
      <AIAnalystPanel
        report={mockReport}
        isLoading={false}
        onRunDiagnostics={vi.fn()}
      />
    );

    expect(screen.getByText("Grade A")).toBeInTheDocument();
    expect(screen.getByText("Video Teratas")).toBeInTheDocument();
    expect(screen.getByText("Replikasi Formula Hook")).toBeInTheDocument();
    expect(screen.getByText(/30,000 views/)).toBeInTheDocument();
  });
});
