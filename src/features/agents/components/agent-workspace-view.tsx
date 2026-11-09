"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { WorkflowLauncherCard } from "./workflow-launcher-card";
import { WorkflowTimelineView } from "./workflow-timeline-view";
import { HumanApprovalDialog } from "./human-approval-dialog";
import { AgentLogViewer } from "./agent-log-viewer";
import { WorkflowSchedulesList } from "./workflow-schedules-list";
import {
  startWorkflowAction,
  executeNextStepAction,
  approveStepAction,
  pauseWorkflowAction,
  resumeWorkflowAction,
  cancelWorkflowAction,
  toggleWorkflowScheduleAction,
  deleteWorkflowScheduleAction,
} from "../actions";
import type {
  WorkflowRunRow,
  WorkflowStepRow,
  WorkflowScheduleRow,
  WorkflowLogRow,
  WorkflowType,
} from "@/lib/supabase/types";

export interface AgentWorkspaceViewProps {
  initialRuns: Array<WorkflowRunRow & { steps: WorkflowStepRow[] }>;
  initialSchedules: WorkflowScheduleRow[];
  initialLogs: WorkflowLogRow[];
}

export function AgentWorkspaceView({
  initialRuns,
  initialSchedules,
  initialLogs,
}: AgentWorkspaceViewProps) {
  const [runs, setRuns] = useState(initialRuns);
  const [schedules, setSchedules] = useState(initialSchedules);
  const [logs, setLogs] = useState(initialLogs);
  const [isProcessing, setIsProcessing] = useState(false);

  // Approval modal state
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    runId: string;
    stepIndex: number;
    stepName: string;
    payload?: Record<string, any>;
  }>({
    isOpen: false,
    runId: "",
    stepIndex: 0,
    stepName: "",
  });

  const handleLaunch = async (workflowType: WorkflowType) => {
    setIsProcessing(true);
    try {
      const titles: Record<WorkflowType, string> = {
        workflow_a_research_to_storyboard: "Workflow A: Research to Storyboard",
        workflow_b_affiliate_pipeline: "Workflow B: Affiliate Product Pipeline",
        workflow_c_analytics_optimization: "Workflow C: Performance to Strategy",
        custom: "Custom Workflow",
      };

      const res = await startWorkflowAction(workflowType, titles[workflowType]);
      if (!res.success) {
        toast.error(res.error || "Gagal memulai workflow");
        return;
      }

      toast.success("Workflow berhasil dimulai! Menjalankan langkah pertama...");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memulai workflow");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteNext = async (runId: string) => {
    setIsProcessing(true);
    try {
      const res = await executeNextStepAction(runId);
      if (!res.success) {
        toast.error(res.error || "Gagal mengeksekusi langkah");
        return;
      }
      toast.success("Langkah berhasil dieksekusi!");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengeksekusi langkah");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePause = async (runId: string) => {
    setIsProcessing(true);
    try {
      const res = await pauseWorkflowAction(runId);
      if (!res.success) {
        toast.error(res.error || "Gagal menjeda workflow");
        return;
      }
      toast.info("Workflow dijeda");
      window.location.reload();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResume = async (runId: string) => {
    setIsProcessing(true);
    try {
      const res = await resumeWorkflowAction(runId);
      if (!res.success) {
        toast.error(res.error || "Gagal melanjutkan workflow");
        return;
      }
      toast.success("Workflow dilanjutkan!");
      window.location.reload();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async (runId: string) => {
    setIsProcessing(true);
    try {
      const res = await cancelWorkflowAction(runId, "Dibatalkan oleh pengguna");
      if (!res.success) {
        toast.error(res.error || "Gagal membatalkan workflow");
        return;
      }
      toast.warning("Workflow berhasil dibatalkan");
      window.location.reload();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const res = await approveStepAction(approvalModal.runId, approvalModal.stepIndex);
      if (!res.success) {
        toast.error(res.error || "Gagal menyetujui langkah");
        return;
      }
      toast.success("Langkah disetujui! Melanjutkan eksekusi...");
      setApprovalModal((prev) => ({ ...prev, isOpen: false }));
      window.location.reload();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleSchedule = async (id: string, currentActive: boolean) => {
    setIsProcessing(true);
    try {
      const res = await toggleWorkflowScheduleAction(id, !currentActive);
      if (!res.success) {
        toast.error(res.error || "Gagal mengubah status jadwal");
        return;
      }
      toast.success(`Jadwal ${!currentActive ? "diaktifkan" : "dijeda"}`);
      window.location.reload();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    setIsProcessing(true);
    try {
      const res = await deleteWorkflowScheduleAction(id);
      if (!res.success) {
        toast.error(res.error || "Gagal menghapus jadwal");
        return;
      }
      toast.success("Jadwal otomasi dihapus");
      window.location.reload();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Agent Ecosystem & Automation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Koordinasi 10 agent spesialis, alur kerja otomatis multi-tahap, persetujuan interaktif, dan kontrol kredit.
        </p>
      </div>

      {/* 2. Workflow Templates Launchers */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Workflow Pipelines Tersedia</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <WorkflowLauncherCard
            workflowType="workflow_a_research_to_storyboard"
            title="Workflow A: Research to Storyboard"
            description="Ekosistem lengkap pembuatan konten: Riset Pasar -> Strategi Pilar -> Ideasi Hook -> Naskah Skrip -> Storyboard Visual."
            estimatedCredits={5}
            steps={["Researcher", "Strategist", "Idea Gen", "Scriptwriter", "Storyboard"]}
            onLaunch={handleLaunch}
            isLoading={isProcessing}
          />

          <WorkflowLauncherCard
            workflowType="workflow_b_affiliate_pipeline"
            title="Workflow B: Affiliate Pipeline"
            description="Optimalisasi produk komersial: Riset Produk -> Posisi Monetisasi -> Naskah Konversi Tinggi -> Brief Grafis Promo."
            estimatedCredits={4}
            steps={["Researcher", "Monetization Coach", "Scriptwriter", "Designer"]}
            onLaunch={handleLaunch}
            isLoading={isProcessing}
          />

          <WorkflowLauncherCard
            workflowType="workflow_c_analytics_optimization"
            title="Workflow C: Analytics Optimization"
            description="Peningkatan berkelanjutan: Data Performa -> Analisis Retensi & Drop-off -> Rekomendasi Taktis -> Strategi Baru."
            estimatedCredits={3}
            steps={["Analyst", "Strategist", "Monetization Coach"]}
            onLaunch={handleLaunch}
            isLoading={isProcessing}
          />
        </div>
      </div>

      {/* 3. Active Workflow Executions */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Eksekusi Workflow Berjalan</h2>
        {runs.length === 0 ? (
          <div className="p-8 border rounded-lg text-center text-sm text-muted-foreground">
            Belum ada workflow aktif. Pilih salah satu pipeline di atas untuk memulai eksekusi agent terkoordinasi.
          </div>
        ) : (
          <div className="space-y-4">
            {runs.map((run) => (
              <WorkflowTimelineView
                key={run.id}
                workflow={run}
                steps={run.steps}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={handleCancel}
                onExecuteNext={handleExecuteNext}
                onInspectOutput={(step) => {
                  setApprovalModal({
                    isOpen: true,
                    runId: run.id,
                    stepIndex: step.step_index,
                    stepName: step.agent_name,
                    payload: (step.output_payload || {}) as Record<string, any>,
                  });
                }}
                isProcessing={isProcessing}
              />
            ))}
          </div>
        )}
      </div>

      {/* 4. Automated Schedules */}
      <div className="space-y-3">
        <WorkflowSchedulesList
          schedules={schedules}
          onToggleActive={handleToggleSchedule}
          onDelete={handleDeleteSchedule}
          isProcessing={isProcessing}
        />
      </div>

      {/* 5. Real-Time Inspectable Log Viewer */}
      <div className="space-y-3">
        <AgentLogViewer logs={logs} />
      </div>

      {/* 6. Human-in-the-Loop Approval Modal */}
      <HumanApprovalDialog
        isOpen={approvalModal.isOpen}
        stepName={approvalModal.stepName}
        stepIndex={approvalModal.stepIndex}
        outputPayload={approvalModal.payload}
        onApprove={handleApprove}
        onReject={() => handleCancel(approvalModal.runId)}
        isLoading={isProcessing}
      />
    </div>
  );
}
