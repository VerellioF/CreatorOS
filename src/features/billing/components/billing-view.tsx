"use client";

import React, { useEffect, useState } from "react";
import { SubscriptionPlansCard } from "@/features/billing/components/subscription-plans-card";
import { PaymentHistoryTable } from "@/features/billing/components/payment-history-table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { Calendar, ShieldAlert } from "lucide-react";
import type { SaasPlanRow, PlanTier, PaymentTransactionRow } from "@/lib/supabase/types";

export interface BillingViewProps {
  workspaceId: string;
  userId: string;
}

export function BillingView({ workspaceId, userId }: BillingViewProps) {
  const [plans, setPlans] = useState<SaasPlanRow[]>([]);
  const [subscription, setSubscription] = useState<{
    planTier: PlanTier;
    status: string;
    currentPeriodEnd: string;
    isPro: boolean;
  }>({
    planTier: "free",
    status: "active",
    currentPeriodEnd: new Date().toISOString(),
    isPro: false,
  });
  const [history, setHistory] = useState<PaymentTransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadBilling() {
      try {
        const res = await fetch(`/api/billing/checkout?workspaceId=${workspaceId}`);
        if (res.ok) {
          const json = await res.json();
          setPlans(json.plans || []);
          if (json.subscription) setSubscription(json.subscription);
          setHistory(json.history || []);
        }
      } catch (err) {
        console.error("Gagal memuat info billing:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadBilling();
  }, [workspaceId]);

  const handleSelectPlan = async (planTier: PlanTier) => {
    setPaymentNotice(
      `CreatorOS saat ini berada dalam tahap Public Beta Gratis (20 Kredit Awal). Pembayaran paket ${planTier.toUpperCase()} akan dibuka saat rilis komersial mendatang. Nikmati seluruh fitur esensial pembuatan naskah secara gratis!`
    );
  };

  if (isLoading) {
    return <LoadingState message="Memuat informasi langganan & pembayaran..." />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Langganan & Penagihan
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola paket langganan workspace Anda, pantau riwayat pembayaran, dan upgrade kuota kredit AI.
        </p>
      </div>

      {/* Active Subscription Overview Banner */}
      <Card className="border border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Paket Saat Ini:</span>
                <span className="text-lg font-bold text-foreground capitalize">
                  {subscription.planTier}
                </span>
                <Badge className="bg-emerald-600 text-white text-xs">
                  {subscription.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Periode Aktif Hingga:{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a href="#plans">
                <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors">
                  Upgrade Paket
                </button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {paymentNotice && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Menunggu Konfirmasi Webhook Server Midtrans</p>
            <p>{paymentNotice}</p>
          </div>
        </div>
      )}

      <div id="plans">
        <SubscriptionPlansCard
          currentPlanTier={subscription.planTier}
          plans={plans}
          onSelectPlan={handleSelectPlan}
          isProcessing={isProcessing}
        />
      </div>

      <PaymentHistoryTable transactions={history} />
    </div>
  );
}
