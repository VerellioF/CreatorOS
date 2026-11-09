"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Eye,
} from "lucide-react";
import type { WorkflowRunRow, WorkflowStepRow } from "@/lib/supabase/types";

export interface WorkflowTimelineViewProps {
  workflow: WorkflowRunRow;
  steps: WorkflowStepRow[];
  onPause?: (runId: string) => void;
  onResume?: (runId: string) => void;
  onCancel?: (runId: string) => void;
  onInspectOutput?: (step: WorkflowStepRow) => void;
  onExecuteNext?: (runId: string) => void;
  isProcessing?: boolean;
}

export function WorkflowTimelineView({
  workflow,
  steps,
  onPause,
  onResume,
  onCancel,
  onInspectOutput,
  onExecuteNext,
  isProcessing = false,
}: WorkflowTimelineViewProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Selesai
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1 animate-pulse">
            <RotateCw className="h-3 w-3 animate-spin" />
            Berjalan
          </Badge>
        );
      case "waiting_approval":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Menunggu Persetujuan
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
            <XCircle className="h-3 w-3" />
            Dibatalkan
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-bold">{workflow.title}</CardTitle>
            {getStatusBadge(workflow.status)}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            ID: {workflow.id} • Langkah {workflow.current_step_index + 1} dari {workflow.total_steps}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {workflow.status === "running" && onPause && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(workflow.id)}
              disabled={isProcessing}
              className="gap-1.5"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Jeda</span>
            </Button>
          )}

          {workflow.status === "waiting_approval" && onResume && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResume(workflow.id)}
              disabled={isProcessing}
              className="gap-1.5 text-blue-600"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Lanjutkan</span>
            </Button>
          )}

          {workflow.status === "running" && onExecuteNext && (
            <Button
              size="sm"
              onClick={() => onExecuteNext(workflow.id)}
              disabled={isProcessing}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Eksekusi Langkah</span>
            </Button>
          )}

          {workflow.status !== "completed" && workflow.status !== "cancelled" && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(workflow.id)}
              disabled={isProcessing}
              className="gap-1.5 text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Batalkan</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step Cards List */}
        <div className="grid gap-2">
          {steps.map((step) => {
            const isCurrent = step.step_index === workflow.current_step_index;
            return (
              <div
                key={step.id || step.step_index}
                className={`p-3 rounded-lg border transition-colors flex items-center justify-between ${
                  isCurrent
                    ? "border-primary/50 bg-primary/5"
                    : step.status === "completed"
                    ? "border-border/60 bg-muted/20"
                    : "border-border/40 opacity-70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                      step.status === "completed"
                        ? "bg-emerald-500/20 text-emerald-600"
                        : isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.step_index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{step.agent_name}</p>
                      {step.requires_approval && (
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                          Review Diperlukan
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {step.tokens_used > 0 ? `${step.tokens_used} tokens • $${Number(step.cost_usd).toFixed(4)}` : "Belum dieksekusi"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(step.status)}
                  {step.output_payload && onInspectOutput && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onInspectOutput(step)}
                      className="h-8 w-8"
                      title="Lihat Hasil Agent"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
