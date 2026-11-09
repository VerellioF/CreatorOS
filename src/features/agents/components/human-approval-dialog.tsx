"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export interface HumanApprovalDialogProps {
  isOpen: boolean;
  stepName: string;
  stepIndex: number;
  outputPayload?: Record<string, any>;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function HumanApprovalDialog({
  isOpen,
  stepName,
  stepIndex,
  outputPayload,
  onApprove,
  onReject,
  isLoading = false,
}: HumanApprovalDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl border-amber-500/40 shadow-2xl bg-card">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
              <AlertCircle className="h-3 w-3" />
              Human Approval Gate
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">Langkah ke-{stepIndex + 1}</span>
          </div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Persetujuan Hasil Agent ({stepName})
          </CardTitle>
          <CardDescription>
            Silakan tinjau output yang dihasilkan oleh agent sebelum melanjutkan ke tahap berikutnya dalam workflow.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
          {outputPayload ? (
            <div className="p-4 rounded-lg bg-muted/40 border border-border text-sm font-sans space-y-3">
              {outputPayload.openingHook && (
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Opening Hook:</p>
                  <p className="font-medium text-foreground bg-background/80 p-2.5 rounded border border-border/50">
                    {outputPayload.openingHook}
                  </p>
                </div>
              )}

              {outputPayload.bodyContent && (
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Body Script:</p>
                  <div className="text-foreground/90 whitespace-pre-wrap bg-background/80 p-2.5 rounded border border-border/50 leading-relaxed">
                    {outputPayload.bodyContent}
                  </div>
                </div>
              )}

              {outputPayload.closingCta && (
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Call to Action (CTA):</p>
                  <p className="font-medium text-foreground bg-background/80 p-2.5 rounded border border-border/50">
                    {outputPayload.closingCta}
                  </p>
                </div>
              )}

              {outputPayload.summary && (
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Ringkasan:</p>
                  <p className="text-foreground/90 bg-background/80 p-2.5 rounded border border-border/50">
                    {outputPayload.summary}
                  </p>
                </div>
              )}

              {/* Raw JSON viewer fallback for unformatted payload keys */}
              {!outputPayload.openingHook && !outputPayload.summary && (
                <pre className="text-xs font-mono bg-background p-3 rounded overflow-x-auto">
                  {JSON.stringify(outputPayload, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Tidak ada payload data untuk ditinjau.</p>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isLoading}
            className="gap-2 text-destructive hover:bg-destructive/10"
          >
            <XCircle className="h-4 w-4" />
            <span>Batalkan Workflow</span>
          </Button>

          <Button
            onClick={onApprove}
            disabled={isLoading}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Setujui & Lanjutkan</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
