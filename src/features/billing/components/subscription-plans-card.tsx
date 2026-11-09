"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Sparkles, ShieldCheck, Crown } from "lucide-react";
import type { SaasPlanRow, PlanTier } from "@/lib/supabase/types";

export interface SubscriptionPlansCardProps {
  currentPlanTier: PlanTier;
  plans: SaasPlanRow[];
  onSelectPlan: (planTier: PlanTier) => void;
  isProcessing?: boolean;
}

export function SubscriptionPlansCard({
  currentPlanTier,
  plans,
  onSelectPlan,
  isProcessing = false,
}: SubscriptionPlansCardProps) {
  const getPlanIcon = (tier: PlanTier) => {
    switch (tier) {
      case "creator":
        return <Zap className="h-5 w-5 text-indigo-500" />;
      case "pro":
        return <Sparkles className="h-5 w-5 text-purple-500" />;
      case "business":
        return <Crown className="h-5 w-5 text-amber-500" />;
      default:
        return <ShieldCheck className="h-5 w-5 text-emerald-500" />;
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return "Gratis";
    return `Rp ${price.toLocaleString("id-ID")}`;
  };

  return (
    <div className="space-y-6">
      {/* Beta Mode Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
          <span>
            <strong>Fase Public Beta Terbuka:</strong> Nikmati seluruh fitur esensial pembuatan naskah, ide, dan kalender konten secara <strong>Gratis dengan 20 Kredit Awal</strong>. Paket berbayar dan fitur studio lanjutan akan dibuka pada rilis publik berikutnya.
          </span>
        </div>
        <Badge variant="comingSoon" className="text-[10px] px-2 py-0.5 shrink-0 font-mono">
          Public Beta
        </Badge>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          Pilihan Paket Langganan (Pratinjau)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Daftar paket masa depan untuk kapasitas komputasi AI tinggi, studio video otomatis, dan publishing multi-platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const isCurrent = currentPlanTier === plan.id;
          const isPopular = plan.id === "creator";

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col justify-between border ${
                isPopular
                  ? "border-indigo-500 shadow-md shadow-indigo-500/10 dark:shadow-indigo-950/20"
                  : "border-border"
              } bg-card`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 text-white font-medium text-[11px] px-2.5 py-0.5">
                    Paling Populer
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-muted/60">{getPlanIcon(plan.id)}</div>
                  {isCurrent && (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-xs">
                      Paket Aktif
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg font-semibold mt-3">{plan.name}</CardTitle>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">
                    {formatPrice(plan.price_idr)}
                  </span>
                  {plan.price_idr > 0 && (
                    <span className="text-xs text-muted-foreground">/bulan</span>
                  )}
                </div>
                <CardDescription className="text-xs mt-1">
                  {plan.monthly_credits.toLocaleString("id-ID")} Kredit AI / bulan
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pb-6 flex-1 text-xs">
                <div className="pt-2 border-t border-border/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Hingga {plan.max_workspaces} Workspace</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Hingga {plan.max_members_per_workspace} Anggota Tim</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Penyimpanan {(plan.max_storage_mb / 1000).toFixed(0)} GB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Semua Model Gemini & AI Studio</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t border-border/40 pt-4">
                {isCurrent ? (
                  <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                    Sedang Digunakan
                  </Button>
                ) : (
                  <Button
                    variant={isPopular ? "default" : "outline"}
                    size="sm"
                    className="w-full text-xs"
                    disabled={isProcessing}
                    onClick={() => onSelectPlan(plan.id)}
                  >
                    Pilih {plan.name}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="p-4 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Pembayaran aman diproses oleh Midtrans (QRIS, GoPay, Transfer Bank BCA/Mandiri/BRI, Kartu Kredit).</span>
        </div>
        <span className="font-mono text-[11px] text-foreground font-medium">Auto-renew bulanan</span>
      </div>
    </div>
  );
}
