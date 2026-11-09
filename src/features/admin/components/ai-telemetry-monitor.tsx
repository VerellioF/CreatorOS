"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, Sparkles, Cpu, Layers } from "lucide-react";
import type { SystemAiUsageMetrics } from "@/services/admin-service";

export interface AiTelemetryMonitorProps {
  metrics: SystemAiUsageMetrics;
}

export function AiTelemetryMonitor({ metrics }: AiTelemetryMonitorProps) {
  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-500" />
          Telemetri Komputasi AI & Penggunaan Provider
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-indigo-500" />
              Google Gemini
            </span>
            <div className="text-base font-bold font-mono text-foreground">
              {metrics.providerBreakdown.gemini.tokens.toLocaleString("id-ID")} tok
            </div>
            <p className="text-[10px] text-muted-foreground">
              ${metrics.providerBreakdown.gemini.costUsd.toFixed(4)} ({metrics.providerBreakdown.gemini.count} call)
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-emerald-500" />
              OpenAI Fallback
            </span>
            <div className="text-base font-bold font-mono text-foreground">
              {metrics.providerBreakdown.openai.tokens.toLocaleString("id-ID")} tok
            </div>
            <p className="text-[10px] text-muted-foreground">
              ${metrics.providerBreakdown.openai.costUsd.toFixed(4)} ({metrics.providerBreakdown.openai.count} call)
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-purple-500" />
              ElevenLabs Voice
            </span>
            <div className="text-base font-bold font-mono text-foreground">
              {metrics.providerBreakdown.elevenlabs.count} synth
            </div>
            <p className="text-[10px] text-muted-foreground">
              ${metrics.providerBreakdown.elevenlabs.costUsd.toFixed(2)}
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3 w-3 text-cyan-500" />
              Runway Video
            </span>
            <div className="text-base font-bold font-mono text-foreground">
              {metrics.providerBreakdown.runway.count} render
            </div>
            <p className="text-[10px] text-muted-foreground">
              ${metrics.providerBreakdown.runway.costUsd.toFixed(2)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
