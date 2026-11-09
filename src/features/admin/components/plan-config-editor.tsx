"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, Check } from "lucide-react";
import type { SaasPlanRow, PlanTier } from "@/lib/supabase/types";

export interface PlanConfigEditorProps {
  plans: SaasPlanRow[];
  onSavePlan: (
    planId: PlanTier,
    updates: Partial<Pick<SaasPlanRow, "price_idr" | "monthly_credits" | "max_workspaces" | "max_storage_mb">>
  ) => Promise<void>;
}

export function PlanConfigEditor({ plans, onSavePlan }: PlanConfigEditorProps) {
  const [editingValues, setEditingValues] = useState<
    Record<string, { price_idr: number; monthly_credits: number; max_workspaces: number; max_storage_mb: number }>
  >(() => {
    const map: Record<string, { price_idr: number; monthly_credits: number; max_workspaces: number; max_storage_mb: number }> = {};
    for (const p of plans) {
      map[p.id] = {
        price_idr: p.price_idr,
        monthly_credits: p.monthly_credits,
        max_workspaces: p.max_workspaces,
        max_storage_mb: p.max_storage_mb,
      };
    }
    return map;
  });

  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);

  const handleChange = (planId: string, field: "price_idr" | "monthly_credits" | "max_workspaces" | "max_storage_mb", val: string) => {
    const num = parseInt(val, 10) || 0;
    setEditingValues((prev) => ({
      ...prev,
      [planId]: {
        ...(prev[planId] || { price_idr: 0, monthly_credits: 0, max_workspaces: 1, max_storage_mb: 500 }),
        [field]: num,
      },
    }));
  };

  const handleSave = async (planId: PlanTier) => {
    const current = editingValues[planId];
    if (!current) return;
    setSavingPlanId(planId);
    try {
      await onSavePlan(planId, current);
      setSavedStatus((prev) => ({ ...prev, [planId]: true }));
      setTimeout(() => {
        setSavedStatus((prev) => ({ ...prev, [planId]: false }));
      }, 2500);
    } finally {
      setSavingPlanId(null);
    }
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5 text-indigo-500" />
          Konfigurasi Paket & Harga SaaS
        </CardTitle>
        <CardDescription>
          Atur harga langganan (Rupiah), kuota kredit bulanan, dan batas workspace untuk setiap tier. Perubahan berlaku langsung pada pendaftaran dan checkout berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((plan) => {
            const vals = editingValues[plan.id] || {
              price_idr: plan.price_idr,
              monthly_credits: plan.monthly_credits,
              max_workspaces: plan.max_workspaces,
              max_storage_mb: plan.max_storage_mb,
            };
            const isSaving = savingPlanId === plan.id;
            const isSaved = Boolean(savedStatus[plan.id]);

            return (
              <div key={plan.id} className="p-4 rounded-lg border border-border bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm capitalize text-foreground">{plan.name}</h4>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {plan.id}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={isSaved ? "default" : "outline"}
                    className="text-xs h-7"
                    disabled={isSaving}
                    onClick={() => handleSave(plan.id)}
                  >
                    {isSaved ? (
                      <>
                        <Check className="h-3 w-3 mr-1 text-emerald-400" />
                        Tersimpan
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-1" />
                        {isSaving ? "Menyimpan..." : "Simpan"}
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-muted-foreground">Harga (IDR / bln)</label>
                    <Input
                      type="number"
                      value={vals.price_idr}
                      onChange={(e) => handleChange(plan.id, "price_idr", e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted-foreground">Kredit Bulanan</label>
                    <Input
                      type="number"
                      value={vals.monthly_credits}
                      onChange={(e) => handleChange(plan.id, "monthly_credits", e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted-foreground">Max Workspace</label>
                    <Input
                      type="number"
                      value={vals.max_workspaces}
                      onChange={(e) => handleChange(plan.id, "max_workspaces", e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-muted-foreground">Penyimpanan (MB)</label>
                    <Input
                      type="number"
                      value={vals.max_storage_mb}
                      onChange={(e) => handleChange(plan.id, "max_storage_mb", e.target.value)}
                      className="text-xs h-8 font-mono"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
