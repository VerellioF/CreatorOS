"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, Layers, CreditCard, Activity, Cpu, ShieldCheck } from "lucide-react";

export interface AdminOverviewProps {
  userCount: number;
  workspaceCount: number;
  activeSubscriptionsCount: number;
  systemStatus: "healthy" | "degraded" | "unhealthy";
  totalAiCostUsd: number;
  totalTokensUsed: number;
}

export function AdminOverview({
  userCount,
  workspaceCount,
  activeSubscriptionsCount,
  systemStatus,
  totalAiCostUsd,
  totalTokensUsed,
}: AdminOverviewProps) {
  const metrics = [
    {
      title: "Total Pengguna",
      value: userCount.toLocaleString("id-ID"),
      icon: <Users className="h-4 w-4 text-indigo-500" />,
      sub: "Akun kreator terdaftar",
    },
    {
      title: "Total Workspace",
      value: workspaceCount.toLocaleString("id-ID"),
      icon: <Layers className="h-4 w-4 text-purple-500" />,
      sub: "Multi-tenant boundaries",
    },
    {
      title: "Langganan Aktif",
      value: activeSubscriptionsCount.toLocaleString("id-ID"),
      icon: <CreditCard className="h-4 w-4 text-emerald-500" />,
      sub: "Creator, Pro, & Business",
    },
    {
      title: "Status Sistem",
      value: systemStatus === "healthy" ? "Normal" : "Perhatian",
      icon: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
      sub: "PostgreSQL & Supabase Online",
    },
    {
      title: "Total Biaya AI (USD)",
      value: `$${totalAiCostUsd.toFixed(2)}`,
      icon: <Activity className="h-4 w-4 text-amber-500" />,
      sub: "Gemini, OpenAI, ElevenLabs",
    },
    {
      title: "Token Terpakai",
      value: totalTokensUsed.toLocaleString("id-ID"),
      icon: <Cpu className="h-4 w-4 text-cyan-500" />,
      sub: "Akumulasi prompt & completion",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((m, idx) => (
        <Card key={idx} className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <span className="text-xs font-medium text-muted-foreground">{m.title}</span>
            {m.icon}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold font-mono text-foreground">{m.value}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{m.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
