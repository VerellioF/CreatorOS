import * as React from "react";
import { Eye, Heart, BarChart3, MousePointerClick, ShoppingBag, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WorkspaceAnalyticsOverview } from "@/lib/analytics/types";

interface AnalyticsOverviewCardProps {
  overview: WorkspaceAnalyticsOverview;
}

export function AnalyticsOverviewCard({ overview }: AnalyticsOverviewCardProps) {
  return (
    <div className="space-y-4">
      {/* Data Source Disclosure Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border/50 bg-muted/20 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Transparansi Data Terverifikasi:</strong> {overview.dataSourcesSummary.connected} akun terhubung,{" "}
            {overview.dataSourcesSummary.manual} input manual tervalidasi. Nol metrik fiktif.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
            Real Data Only
          </Badge>
          <Badge variant="secondary" className="text-[11px] capitalize">
            Periode: {overview.dateRange}
          </Badge>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Views */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Views</CardTitle>
            <Eye className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {overview.totalViews.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Akumulasi seluruh tayangan postingan
            </p>
          </CardContent>
        </Card>

        {/* Total Engagement */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Engagement</CardTitle>
            <Heart className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {overview.totalEngagement.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Likes, comments, shares & saves
            </p>
          </CardContent>
        </Card>

        {/* Average Engagement Rate */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Engagement Rate</CardTitle>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {overview.averageEngagementRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Rasio interaksi terhadap views
            </p>
          </CardContent>
        </Card>

        {/* Clicks (Where available) */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Link Clicks</CardTitle>
            <MousePointerClick className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            {overview.totalClicks !== null ? (
              <div className="text-2xl font-bold tracking-tight">
                {overview.totalClicks.toLocaleString()}
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground/70 py-1">
                Belum ada data
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {overview.hasClickTracking
                ? "Terekam dari link bio / deskripsi"
                : "Tergantung platform / tautan"}
            </p>
          </CardContent>
        </Card>

        {/* Conversions (Where available) */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Konversi Penjualan</CardTitle>
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {overview.totalConversions !== null ? (
              <div className="text-2xl font-bold tracking-tight">
                {overview.totalConversions.toLocaleString()}
              </div>
            ) : (
              <div className="text-sm font-medium text-muted-foreground/70 py-1">
                Belum ada data
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              {overview.hasConversionTracking
                ? "Pesanan affiliate / produk"
                : "Tergantung pelacakan konversi"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
