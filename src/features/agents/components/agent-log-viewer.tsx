"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, Filter, RefreshCw } from "lucide-react";
import type { WorkflowLogRow } from "@/lib/supabase/types";

export interface AgentLogViewerProps {
  logs: WorkflowLogRow[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function AgentLogViewer({ logs, onRefresh, isLoading = false }: AgentLogViewerProps) {
  const [filterLevel, setFilterLevel] = useState<string>("all");

  const filteredLogs = logs.filter((l) => {
    if (filterLevel === "all") return true;
    return l.log_level === filterLevel;
  });

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge variant="destructive" className="text-[10px] uppercase font-mono">ERROR</Badge>;
      case "warn":
        return <Badge variant="outline" className="text-[10px] uppercase font-mono bg-amber-500/10 text-amber-600 border-amber-500/30">WARN</Badge>;
      case "debug":
        return <Badge variant="outline" className="text-[10px] uppercase font-mono bg-purple-500/10 text-purple-600 border-purple-500/30">DEBUG</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] uppercase font-mono bg-blue-500/10 text-blue-600 border-blue-500/30">INFO</Badge>;
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Log Eksekusi Agent</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">({filteredLogs.length} entri)</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-md text-xs font-mono">
            {["all", "info", "warn", "error"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2 py-0.5 rounded capitalize transition-colors ${
                  filterLevel === lvl
                    ? "bg-background text-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 w-8"
              title="Perbarui Log"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground font-mono">
            Belum ada catatan log untuk filter ini.
          </div>
        ) : (
          <div className="rounded-lg bg-black/85 text-zinc-200 p-3.5 font-mono text-xs max-h-80 overflow-y-auto space-y-2 border border-zinc-800">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 leading-relaxed border-b border-zinc-800/60 pb-1.5 last:border-0 last:pb-0">
                <span className="text-zinc-500 whitespace-nowrap text-[11px]">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                {getLevelBadge(log.log_level)}
                <span className="text-primary-foreground/90 font-bold whitespace-nowrap">
                  [{log.agent_name}]
                </span>
                <span className="text-zinc-300 break-words flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
