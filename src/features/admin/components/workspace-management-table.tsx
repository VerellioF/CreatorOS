"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Layers, Coins, Plus } from "lucide-react";

export interface AdminWorkspaceItem {
  id: string;
  name: string;
  slug: string;
  creator_mode: string;
  created_at: string;
}

export interface WorkspaceManagementTableProps {
  workspaces: AdminWorkspaceItem[];
  onAdjustCredits: (workspaceId: string, amount: number, reason: string) => Promise<void>;
}

export function WorkspaceManagementTable({
  workspaces,
  onAdjustCredits,
}: WorkspaceManagementTableProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<AdminWorkspaceItem | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(100);
  const [adjustReason, setAdjustReason] = useState<string>("Bonus promosi superadmin");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmAdjust = async () => {
    if (!selectedWorkspace) return;
    setIsSubmitting(true);
    try {
      await onAdjustCredits(selectedWorkspace.id, creditAmount, adjustReason);
      setSelectedWorkspace(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-500" />
          Manajemen Workspace & Alokasi Kredit
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workspaces.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Belum ada workspace terdaftar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-muted-foreground border-b border-border/80 pb-2">
                <tr>
                  <th className="py-2 font-medium">Nama Workspace</th>
                  <th className="py-2 font-medium">Slug</th>
                  <th className="py-2 font-medium">Mode Kreator</th>
                  <th className="py-2 font-medium">Terdaftar</th>
                  <th className="py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {workspaces.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30">
                    <td className="py-2.5 font-medium text-foreground">{w.name}</td>
                    <td className="py-2.5 font-mono text-muted-foreground">{w.slug}</td>
                    <td className="py-2.5 capitalize">{w.creator_mode}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {new Date(w.created_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-7"
                        onClick={() => setSelectedWorkspace(w)}
                      >
                        <Coins className="h-3 w-3 mr-1 text-amber-500" />
                        Atur Kredit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Adjust Credits Dialog */}
      <Dialog open={Boolean(selectedWorkspace)} onOpenChange={(open) => !open && setSelectedWorkspace(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Penyesuaian Kredit: {selectedWorkspace?.name}</DialogTitle>
            <DialogDescription>
              Tambah atau kurangi saldo kredit komputasi AI workspace secara instan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium">Jumlah Kredit (Positif = Tambah, Negatif = Potong)</label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseInt(e.target.value, 10) || 0)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-medium">Alasan Penyesuaian</label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedWorkspace(null)}>
              Batal
            </Button>
            <Button size="sm" disabled={isSubmitting || creditAmount === 0} onClick={handleConfirmAdjust}>
              {isSubmitting ? "Menyimpan..." : "Simpan Penyesuaian"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
