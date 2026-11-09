"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { PaymentTransactionRow, PaymentStatus } from "@/lib/supabase/types";

export interface PaymentHistoryTableProps {
  transactions: PaymentTransactionRow[];
}

export function PaymentHistoryTable({ transactions }: PaymentHistoryTableProps) {
  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "settlement":
      case "capture":
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Lunas
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Menunggu Pembayaran
          </Badge>
        );
      case "expire":
      case "cancel":
        return (
          <Badge variant="secondary" className="text-xs text-muted-foreground">
            Kedaluwarsa
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Gagal
          </Badge>
        );
    }
  };

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-indigo-500" />
          Riwayat Pembayaran & Tagihan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Belum ada transaksi pembayaran.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-muted-foreground border-b border-border/80 pb-2">
                <tr>
                  <th className="py-2 font-medium">Order ID</th>
                  <th className="py-2 font-medium">Paket</th>
                  <th className="py-2 font-medium">Nominal (IDR)</th>
                  <th className="py-2 font-medium">Metode</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-mono font-medium text-foreground">{tx.order_id}</td>
                    <td className="py-3 capitalize text-foreground">{tx.plan_tier}</td>
                    <td className="py-3 font-mono font-medium text-foreground">
                      Rp {Number(tx.gross_amount).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 uppercase text-muted-foreground">
                      {tx.payment_type || "Midtrans Snap"}
                    </td>
                    <td className="py-3">{getStatusBadge(tx.transaction_status)}</td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
