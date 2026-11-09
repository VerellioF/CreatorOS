"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminOverview } from "@/features/admin/components/admin-overview";
import { PlanConfigEditor } from "@/features/admin/components/plan-config-editor";
import { UserManagementTable, type AdminUserItem } from "@/features/admin/components/user-management-table";
import { WorkspaceManagementTable, type AdminWorkspaceItem } from "@/features/admin/components/workspace-management-table";
import { AiTelemetryMonitor } from "@/features/admin/components/ai-telemetry-monitor";
import { SystemHealthPanel } from "@/features/admin/components/system-health-panel";
import { LoadingState } from "@/components/ui/loading-state";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { SaasPlanRow, PlanTier } from "@/lib/supabase/types";
import type { SystemHealthReport, SystemAiUsageMetrics } from "@/services/admin-service";

export default function AdminDashboardPage() {
  const [plans, setPlans] = useState<SaasPlanRow[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceItem[]>([]);
  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [metrics, setMetrics] = useState<SystemAiUsageMetrics>({
    totalTokensUsed: 0,
    totalCostUsd: 0,
    totalOperations: 0,
    providerBreakdown: {
      gemini: { tokens: 0, costUsd: 0, count: 0 },
      openai: { tokens: 0, costUsd: 0, count: 0 },
      elevenlabs: { count: 0, costUsd: 0 },
      runway: { count: 0, costUsd: 0 },
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [healthRes, plansRes, usersRes, wsRes] = await Promise.all([
          fetch("/api/admin/health"),
          fetch("/api/admin/plans"),
          fetch("/api/admin/users"),
          fetch("/api/admin/workspaces"),
        ]);

        if (!healthRes.ok) {
          if (healthRes.status === 403) {
            throw new Error("Akses Ditolak: Anda bukan Superadmin CreatorOS AI.");
          }
        }

        const healthJson = healthRes.ok ? await healthRes.json() : null;
        const plansJson = plansRes.ok ? await plansRes.json() : null;
        const usersJson = usersRes.ok ? await usersRes.json() : null;
        const wsJson = wsRes.ok ? await wsRes.json() : null;

        if (healthJson?.health) setHealth(healthJson.health);
        if (healthJson?.metrics) setMetrics(healthJson.metrics);
        if (plansJson?.plans) setPlans(plansJson.plans);
        if (usersJson?.users) setUsers(usersJson.users);
        if (wsJson?.workspaces) setWorkspaces(wsJson.workspaces);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data admin");
      } finally {
        setIsLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const handleSavePlan = async (
    planId: PlanTier,
    updates: Partial<Pick<SaasPlanRow, "price_idr" | "monthly_credits" | "max_workspaces" | "max_storage_mb">>
  ) => {
    const res = await fetch("/api/admin/plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, updates }),
    });

    if (res.ok) {
      const json = await res.json();
      setPlans((prev) => prev.map((p) => (p.id === planId ? json.plan : p)));
    }
  };

  const handleAdjustCredits = async (workspaceId: string, amount: number, reason: string) => {
    await fetch("/api/admin/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adjust_credits",
        workspaceId,
        amount,
        reason,
      }),
    });
  };

  if (isLoading) {
    return <LoadingState message="Memverifikasi hak akses Superadmin & memuat konsol..." />;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-24 p-6 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-center space-y-4">
        <ShieldAlert className="h-10 w-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Akses Terbatas</h2>
        <p className="text-xs text-muted-foreground">{error}</p>
        <div className="pt-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              Kembali ke Dashboard Utama
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-purple-600" />
            Superadmin & System Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Portal kontrol SaaS sentral: manajemen harga paket, alokasi kredit, pengguna, telemetri AI, dan kesehatan infrastruktur.
          </p>
        </div>
      </div>

      <AdminOverview
        userCount={users.length || 1}
        workspaceCount={workspaces.length || 1}
        activeSubscriptionsCount={workspaces.length || 1}
        systemStatus={health?.status || "healthy"}
        totalAiCostUsd={metrics.totalCostUsd}
        totalTokensUsed={metrics.totalTokensUsed}
      />

      {health && <SystemHealthPanel health={health} />}

      <PlanConfigEditor plans={plans} onSavePlan={handleSavePlan} />

      <AiTelemetryMonitor metrics={metrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <WorkspaceManagementTable
          workspaces={workspaces}
          onAdjustCredits={handleAdjustCredits}
        />
        <UserManagementTable users={users} />
      </div>
    </div>
  );
}
