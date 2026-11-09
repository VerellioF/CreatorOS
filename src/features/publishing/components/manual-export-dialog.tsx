"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Copy, Check, ExternalLink, Sparkles, CheckCircle2 } from "lucide-react";
import type { ManualExportPackage } from "@/lib/publishing/types";

export interface ManualExportDialogProps {
  isOpen: boolean;
  jobId: string;
  exportData: ManualExportPackage;
  onConfirmPublish: (jobId: string, externalPostUrl: string) => Promise<void>;
  onClose: () => void;
}

export function ManualExportDialog({
  isOpen,
  jobId,
  exportData,
  onConfirmPublish,
  onClose,
}: ManualExportDialogProps) {
  const [postUrl, setPostUrl] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  const toggleCheck = (idx: number) => {
    setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyCaption = () => {
    const textToCopy = `${exportData.title}\n\n${exportData.caption}\n\n${exportData.recommendedHashtags.join(" ")}`;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (!postUrl) return;
    setIsSubmitting(true);
    try {
      await onConfirmPublish(jobId, postUrl);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const platformTitle =
    exportData.platform === "shopee" ? "Shopee Video" : exportData.platform.toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Ekspor Manual {platformTitle}
          </DialogTitle>
          <DialogDescription>
            Platform ini memerlukan alur publikasi manual melalui aplikasi resmi. Ikuti panduan langkah demi langkah di bawah untuk menerbitkan konten Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Step 1: Media Download */}
          <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">1. Download File Video</span>
              <a href={exportData.downloadUrl} download target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="default" className="text-xs">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download Video
                </Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: MP4 (Rasio 9:16, 1080p). Siap diunggah ke aplikasi mobile.
            </p>
          </div>

          {/* Step 2: Copy Caption & Hashtags */}
          <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">2. Salin Caption & Tagar</span>
              <Button size="sm" variant="outline" className="text-xs" onClick={copyCaption}>
                {isCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Salin Teks
                  </>
                )}
              </Button>
            </div>
            <div className="p-3 rounded bg-background border border-border/80 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
              <p className="font-semibold text-foreground">{exportData.title}</p>
              <p className="mt-1">{exportData.caption}</p>
              <p className="mt-2 text-indigo-500">{exportData.recommendedHashtags.join(" ")}</p>
            </div>
          </div>

          {/* Step 3: Interactive Checklist */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">3. Checklist Langkah Publikasi</span>
            <div className="space-y-2">
              {exportData.checklist.map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded border border-border bg-card hover:bg-muted/30 cursor-pointer text-xs transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checkedSteps[idx])}
                    onChange={() => toggleCheck(idx)}
                    className="mt-0.5 rounded border-input"
                  />
                  <span className={checkedSteps[idx] ? "line-through text-muted-foreground" : "text-foreground"}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Step 4: Submit Confirmation Link */}
          <div className="p-4 rounded-lg border border-border bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              4. Masukkan Link Konfirmasi Video Setelah Terbit
            </span>
            <Input
              placeholder="https://id.shp.ee/v/xxxxxxxx"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              className="bg-background text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              CreatorOS AI tidak akan menandai konten sebagai &apos;published&apos; sebelum Anda mengonfirmasi tautan publikasi resmi.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
          <Button
            size="sm"
            disabled={!postUrl || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? "Mengonfirmasi..." : "Konfirmasi Publikasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
