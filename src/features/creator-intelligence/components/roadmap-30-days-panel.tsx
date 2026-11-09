"use client";

import * as React from "react";
import { toast } from "sonner";
import { Calendar, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toggleRoadmapTaskAction } from "@/features/creator-intelligence/actions";
import type { RoadmapWeek } from "@/lib/validation/creator-intelligence-schemas";

interface Roadmap30DaysPanelProps {
  workspaceId: string;
  canEdit: boolean;
  initialRoadmap: RoadmapWeek[];
}

export function Roadmap30DaysPanel({
  workspaceId,
  canEdit,
  initialRoadmap,
}: Roadmap30DaysPanelProps) {
  const [weeks, setWeeks] = React.useState<RoadmapWeek[]>(initialRoadmap);
  const [pendingTaskId, setPendingTaskId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setWeeks(initialRoadmap);
  }, [initialRoadmap]);

  if (weeks.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Calendar}
            title="Roadmap 30 Hari Belum Tersimpan"
            description="Selesaikan wawancara onboarding dan klik Sintesis Creator DNA & Roadmap 30 Hari untuk menyusun rencana kerja 4 minggu yang sesuai jadwal luang Anda."
            className="p-8"
          />
        </CardContent>
      </Card>
    );
  }

  const allTasks = weeks.flatMap((w) => w.tasks);
  const completedTasks = allTasks.filter((t) => t.completed).length;
  const completionPct =
    allTasks.length > 0
      ? Math.round((completedTasks / allTasks.length) * 100)
      : 0;

  const handleToggle = async (taskId: string, nextCompleted: boolean) => {
    if (!canEdit) return;
    setPendingTaskId(taskId);

    // Optimistic UI update backed by real DB persistence
    const previous = weeks;
    setWeeks((curr) =>
      curr.map((w) => ({
        ...w,
        tasks: w.tasks.map((t) =>
          t.id === taskId ? { ...t, completed: nextCompleted } : t
        ),
      }))
    );

    try {
      const res = await toggleRoadmapTaskAction(
        workspaceId,
        taskId,
        nextCompleted
      );
      if (res.success) {
        setWeeks(res.roadmap30Days);
      } else {
        setWeeks(previous);
        toast.error(res.error);
      }
    } catch {
      setWeeks(previous);
      toast.error("Gagal memperbarui status tugas roadmap.");
    } finally {
      setPendingTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                30-Day Creator Execution Roadmap
              </CardTitle>
              <CardDescription className="text-xs">
                Centang setiap deliverable yang selesai — progres tersimpan otomatis ke database workspace Anda.
              </CardDescription>
            </div>
            <Badge variant="default" className="text-xs">
              {completedTasks}/{allTasks.length} Tugas Selesai ({completionPct}%)
            </Badge>
          </div>
          <div className="h-2 w-full rounded-full bg-muted mt-3 overflow-hidden">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.max(4, completionPct)}%` }}
            />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {weeks.map((week) => (
          <Card key={week.weekNumber} className="flex flex-col">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px]">
                  Minggu {week.weekNumber}
                </Badge>
                <span className="text-[11px] font-medium text-primary">
                  {week.postingCadence}
                </span>
              </div>
              <CardTitle className="text-sm font-semibold mt-1">
                {week.theme}
              </CardTitle>
              <CardDescription className="text-xs">
                Target: {week.weeklyGoal}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 flex-1">
              {week.tasks.map((task) => {
                const isUpdating = pendingTaskId === task.id;
                return (
                  <button
                    key={task.id}
                    type="button"
                    disabled={!canEdit || isUpdating}
                    onClick={() => handleToggle(task.id, !task.completed)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors flex items-start gap-2.5 ${
                      task.completed
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border/70 bg-card hover:bg-accent/40"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {task.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-1 text-xs flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span
                          className={`font-semibold ${
                            task.completed
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {task.dayRange} • {task.contentFormat}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {task.actionDescription}
                      </p>
                      <p className="text-[10px] font-medium text-primary/90">
                        Output: {task.deliverableOutput}
                      </p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
