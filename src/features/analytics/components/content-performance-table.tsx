import * as React from "react";
import { useState } from "react";
import { Eye, Heart, MessageCircle, Share2, Bookmark, ExternalLink, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ContentPerformanceItem } from "@/lib/analytics/types";

interface ContentPerformanceTableProps {
  items: ContentPerformanceItem[];
}

export function ContentPerformanceTable({ items }: ContentPerformanceTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.postTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = selectedPlatform === "all" || item.platform === selectedPlatform;
    return matchesSearch && matchesPlatform;
  });

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Daftar Kinerja Konten</CardTitle>
            <CardDescription>Rincian performa per konten dengan identifikasi sumber data</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari judul konten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-sm"
            >
              <option value="all">Semua Platform</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
              <option value="shopee_video">Shopee Video</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg border-border/60 text-sm text-muted-foreground">
            Tidak ada konten yang sesuai dengan pencarian atau filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-border/60 text-muted-foreground bg-muted/20">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Judul Konten & Platform</th>
                  <th className="py-2.5 px-3 font-semibold">Views</th>
                  <th className="py-2.5 px-3 font-semibold">Engagement (ER%)</th>
                  <th className="py-2.5 px-3 font-semibold">Rincian Interaksi</th>
                  <th className="py-2.5 px-3 font-semibold">Sumber Data</th>
                  <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-3 max-w-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground line-clamp-1">
                            {item.postTitle}
                          </span>
                          {item.postUrl && (
                            <a
                              href={item.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.platform}
                        </Badge>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono font-medium text-foreground">
                      {item.views.toLocaleString()}
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-amber-400 font-mono">
                          {item.engagementRate}%
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {item.totalEngagement.toLocaleString()} total
                        </p>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-muted-foreground">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-3 h-3 text-rose-400" /> {item.likes}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="w-3 h-3 text-blue-400" /> {item.comments}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Share2 className="w-3 h-3 text-emerald-400" /> {item.shares}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Bookmark className="w-3 h-3 text-amber-400" /> {item.saves}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          item.isManualEntry
                            ? "bg-muted text-muted-foreground"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {item.isManualEntry ? "Input Manual" : "Akun Terhubung"}
                      </Badge>
                    </td>

                    <td className="py-3 px-3 text-muted-foreground text-[11px] whitespace-nowrap">
                      {item.snapshotDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
