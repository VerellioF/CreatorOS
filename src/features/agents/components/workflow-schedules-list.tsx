"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, ShieldCheck, Power, Trash2 } from "lucide-react";
import type { WorkflowScheduleRow } from "@/lib/supabase/types";

export interface WorkflowSchedulesListProps {
  schedules: WorkflowScheduleRow[];
  onToggleActive: (id: string, currentActive: boolean) => void;
  onDelete: (id: string) => void;
  isProcessing?: boolean;
}

export function WorkflowSchedulesList({
  schedules,
  onToggleActive,
  onDelete,
  isProcessing = false,
}: WorkflowSchedulesListProps) {
  if (schedules.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="p-8 text-center space-y-2">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">Belum ada otomasi terjadwal</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Jadwalkan workflow berulang untuk riset mingguan, pembuatan ide, atau evaluasi performa tanpa batas autonomous liar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Otomasi & Jadwal Berulang</CardTitle>
          <Badge variant="outline" className="text-xs gap-1 font-mono">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Max 5 Turns Cap Enforced
          </Badge>
        </div>
        <CardDescription>
          Workflow yang dijadwalkan berjalan secara otomatis dengan pengamanan limit token dan credit.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="p-3.5 rounded-lg border border-border flex items-center justify-between gap-4 bg-muted/20"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{schedule.name}</p>
                {schedule.is_active ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Aktif
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Nonaktif
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Cron: {schedule.cron_expression}
                </span>
                <span>•</span>
                <span>Max Turns: {schedule.max_autonomous_turns}</span>
                {schedule.next_run_at && (
                  <>
                    <span>•</span>
                    <span>Next: {new Date(schedule.next_run_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleActive(schedule.id, schedule.is_active)}
                disabled={isProcessing}
                className="gap-1.5"
              >
                <Power className="h-3.5 w-3.5" />
                <span>{schedule.is_active ? "Jeda" : "Aktifkan"}</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(schedule.id)}
                disabled={isProcessing}
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
