"use client";

import React, { useEffect, useState } from "react";
import { SocialAccountsManager } from "@/features/publishing/components/social-accounts-manager";
import { PublishComposer } from "@/features/publishing/components/publish-composer";
import { PublishingHistoryList } from "@/features/publishing/components/publishing-history-list";
import { ManualExportDialog } from "@/features/publishing/components/manual-export-dialog";
import { LoadingState } from "@/components/ui/loading-state";
import type { SocialAccountRow, PublishingJobRow, PublishingPlatform } from "@/lib/supabase/types";
import type { ManualExportPackage } from "@/lib/publishing/types";
import type { CreatePublishingJobParams } from "@/services/publishing-service";

export interface PublishingViewProps {
  workspaceId: string;
  userId: string;
}

export function PublishingView({ workspaceId, userId }: PublishingViewProps) {
  const [accounts, setAccounts] = useState<SocialAccountRow[]>([]);
  const [jobs, setJobs] = useState<PublishingJobRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeManualExport, setActiveManualExport] = useState<{
    jobId: string;
    data: ManualExportPackage;
  } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/workspace/publishing?workspaceId=${workspaceId}`);
        if (res.ok) {
          const json = await res.json();
          setAccounts(json.accounts || []);
          setJobs(json.jobs || []);
        }
      } catch (err) {
        console.error("Gagal memuat data publikasi:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [workspaceId]);

  const handleConnect = async (
    platform: PublishingPlatform,
    accountDetails: { accountId: string; accountName: string }
  ) => {
    try {
      const res = await fetch("/api/workspace/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect_account",
          workspaceId,
          platform,
          accountDetails,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setAccounts((prev) => [json.account, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      const res = await fetch("/api/workspace/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disconnect_account",
          workspaceId,
          accountId,
        }),
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitJob = async (params: CreatePublishingJobParams) => {
    const res = await fetch("/api/workspace/publishing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const json = await res.json();
      const newJob = json.job as PublishingJobRow;
      setJobs((prev) => [newJob, ...prev]);

      // If Shopee or manual export, prepare export package
      if (newJob.platform === "shopee") {
        const exportRes = await fetch(`/api/workspace/publishing/${newJob.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "prepare_manual_export",
            workspaceId,
          }),
        });

        if (exportRes.ok) {
          const exportJson = await exportRes.json();
          setActiveManualExport({
            jobId: newJob.id,
            data: exportJson.manualExportData,
          });
        }
      }
    } else {
      const errJson = await res.json();
      throw new Error(errJson.error || "Gagal membuat jadwal");
    }
  };

  const handleConfirmManualPublish = async (jobId: string, externalPostUrl: string) => {
    const res = await fetch(`/api/workspace/publishing/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_manual_publish",
        workspaceId,
        externalPostUrl,
      }),
    });

    if (res.ok) {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? { ...j, status: "published", external_post_url: externalPostUrl, published_at: new Date().toISOString() }
            : j
        )
      );
    }
  };

  if (isLoading) {
    return <LoadingState message="Memuat Pusat Publikasi..." />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Pusat Publikasi & Editorial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola kanal penerbitan resmi, jadwalkan tayangan konten, dan operasikan alur ekspor manual untuk Shopee Video.
        </p>
      </div>

      <SocialAccountsManager
        accounts={accounts}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PublishComposer
          workspaceId={workspaceId}
          userId={userId}
          accounts={accounts}
          onSubmitJob={handleSubmitJob}
        />

        <PublishingHistoryList
          jobs={jobs}
          onOpenManualExport={(job) => {
            if (job.manual_export_data) {
              setActiveManualExport({
                jobId: job.id,
                data: job.manual_export_data as unknown as ManualExportPackage,
              });
            }
          }}
        />
      </div>

      {activeManualExport && (
        <ManualExportDialog
          isOpen={Boolean(activeManualExport)}
          jobId={activeManualExport.jobId}
          exportData={activeManualExport.data}
          onConfirmPublish={handleConfirmManualPublish}
          onClose={() => setActiveManualExport(null)}
        />
      )}
    </div>
  );
}
