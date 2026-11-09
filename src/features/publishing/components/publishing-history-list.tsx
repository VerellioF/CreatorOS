"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, AlertCircle, ExternalLink, History, Download } from "lucide-react";
import type { PublishingJobRow, PublishingJobStatus } from "@/lib/supabase/types";

export interface PublishingHistoryListProps {
  jobs: PublishingJobRow[];
  onOpenManualExport: (job: PublishingJobRow) => void;
}

export function PublishingHistoryList({
  jobs,
  onOpenManualExport,
}: PublishingHistoryListProps) {
  const getStatusBadge = (status: PublishingJobStatus) => {
    switch (status) {
      case "published":
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Terbit
          </Badge>
        );
      case "publishing":
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
            <Clock className="h-3 w-3 mr-1 animate-spin" />
            Memproses
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="outline" className="text-indigo-600 border-indigo-500/30 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Terjadwal
          </Badge>
        );
      case "manual_export_ready":
        return (
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-xs">
            <Download className="h-3 w-3 mr-1" />
            Siap Ekspor Manual
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Gagal
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Draft
          </Badge>
        );
    }
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-500" />
          Riwayat & Status Publikasi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Belum ada antrean atau riwayat publikasi. Buat jadwal di atas untuk memulai.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {jobs.map((job) => (
              <div key={job.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {job.platform}
                    </span>
                    <h4 className="text-sm font-medium text-foreground truncate">{job.title}</h4>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {job.caption || "Tanpa caption"}
                  </p>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                    {job.scheduled_for && (
                      <span>Jadwal: {new Date(job.scheduled_for).toLocaleString("id-ID")}</span>
                    )}
                    {job.published_at && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Terbit: {new Date(job.published_at).toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {job.status === "manual_export_ready" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => onOpenManualExport(job)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Buka Paket Ekspor
                    </Button>
                  )}
                  {job.external_post_url && (
                    <a href={job.external_post_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="text-xs text-indigo-600">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Buka Postingan
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
