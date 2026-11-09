"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Database, HardDrive, Cpu, Clock } from "lucide-react";
import type { SystemHealthReport } from "@/services/admin-service";

export interface SystemHealthPanelProps {
  health: SystemHealthReport;
}

export function SystemHealthPanel({ health }: SystemHealthPanelProps) {
  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Kesehatan & Diagnostik Sistem
          </CardTitle>
          <Badge
            variant={health.status === "healthy" ? "default" : "destructive"}
            className={health.status === "healthy" ? "bg-emerald-600 text-xs" : "text-xs"}
          >
            {health.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded border border-border bg-muted/20 flex items-center gap-3">
            <Database className="h-4 w-4 text-indigo-500 shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Database PostgreSQL</span>
              <span className="font-semibold text-emerald-600 capitalize">{health.database}</span>
            </div>
          </div>

          <div className="p-3 rounded border border-border bg-muted/20 flex items-center gap-3">
            <HardDrive className="h-4 w-4 text-cyan-500 shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Media Storage</span>
              <span className="font-semibold text-emerald-600 capitalize">{health.mediaStorage}</span>
            </div>
          </div>

          <div className="p-3 rounded border border-border bg-muted/20 flex items-center gap-3">
            <Cpu className="h-4 w-4 text-purple-500 shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Memori Node.js</span>
              <span className="font-semibold font-mono">{health.memoryUsageMb} MB</span>
            </div>
          </div>

          <div className="p-3 rounded border border-border bg-muted/20 flex items-center gap-3">
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <span className="text-muted-foreground block text-[11px]">Waktu Uptime</span>
              <span className="font-semibold font-mono">{health.uptimeSeconds} detik</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
