import * as React from "react";
import { Share2, Video, Film, Eye, Heart, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlatformMetricBreakdown } from "@/lib/analytics/types";

interface PlatformComparisonChartProps {
  platforms: PlatformMetricBreakdown[];
}

export function PlatformComparisonChart({ platforms }: PlatformComparisonChartProps) {
  if (platforms.length === 0) {
    return (
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Komparasi Antar Platform</CardTitle>
          <CardDescription>Distribusi performa konten berdasarkan kanal publikasi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg border-border/60">
            Belum ada metrik platform yang tercatat
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find max views for proportional bar width
  const maxViews = Math.max(...platforms.map((p) => p.totalViews), 1);

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Komparasi Kinerja Platform</CardTitle>
            <CardDescription>Perbandingan views, engagement rate, dan sumber data tiap kanal</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {platforms.length} Platform Aktif
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {platforms.map((plat) => {
          const widthPercent = Math.max(5, Math.min(100, Math.round((plat.totalViews / maxViews) * 100)));

          return (
            <div key={plat.platform} className="space-y-1.5 p-3 rounded-lg border border-border/40 bg-background/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold capitalize text-foreground">{plat.platform}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {plat.postCount} postingan
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      plat.dataSource === "connected_account"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : "border-border/60 text-muted-foreground"
                    }`}
                  >
                    {plat.dataSource === "connected_account"
                      ? "Akun Terhubung"
                      : plat.dataSource === "manual_entry"
                      ? "Input Manual"
                      : "Mixed"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="font-medium text-foreground">{plat.totalViews.toLocaleString()} views</span>
                  <span>•</span>
                  <span>{plat.totalEngagement.toLocaleString()} interaksi</span>
                  <span>•</span>
                  <span className="font-semibold text-amber-400">{plat.averageEngagementRate}% ER</span>
                </div>
              </div>

              {/* Bar visualization */}
              <div className="w-full h-2.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 pt-0.5">
                <span>
                  Klik Tautan: {plat.clicks !== null ? plat.clicks.toLocaleString() : "Tidak Tersedia"}
                </span>
                <span>
                  Konversi Penjualan: {plat.conversions !== null ? plat.conversions.toLocaleString() : "Tidak Tersedia"}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
