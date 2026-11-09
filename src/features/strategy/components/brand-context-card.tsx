"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { saveBrandProfileAction } from "@/features/strategy/actions";
import type { BrandProfileInput } from "@/lib/validation/strategy-and-content-schemas";

interface BrandContextCardProps {
  workspaceId: string;
  defaultName: string;
  initialBrand: BrandProfileInput | null;
  canEdit: boolean;
}

export function BrandContextCard({
  workspaceId,
  defaultName,
  initialBrand,
  canEdit,
}: BrandContextCardProps) {
  const [brandName, setBrandName] = React.useState(
    initialBrand?.brandName || defaultName
  );
  const [tagline, setTagline] = React.useState(initialBrand?.tagline || "");
  const [positioningStatement, setPositioningStatement] = React.useState(
    initialBrand?.positioningStatement || ""
  );
  const [offerSummary, setOfferSummary] = React.useState(
    initialBrand?.offerSummary || ""
  );
  const [valuesText, setValuesText] = React.useState(
    initialBrand?.brandValues.join(", ") || ""
  );
  const [voiceText, setVoiceText] = React.useState(
    initialBrand?.voiceGuidelines.join(", ") || ""
  );
  const [isPending, startTransition] = React.useTransition();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveBrandProfileAction(workspaceId, {
        brandName: brandName.trim(),
        tagline: tagline.trim(),
        positioningStatement: positioningStatement.trim(),
        offerSummary: offerSummary.trim(),
        brandValues: valuesText
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length >= 2),
        voiceGuidelines: voiceText
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length >= 2),
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Brand Context & Positioning berhasil disimpan.");
    });
  };

  return (
    <Card className="border-border/80">
      <form onSubmit={handleSave}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Brand Context & Positioning</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Konteks brand, penawaran, dan panduan komunikasi ini otomatis diinjeksikan ke Idea Generator dan Script Studio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nama Brand / Kreator</label>
              <Input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                disabled={!canEdit || isPending}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Tagline Singkat</label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Contoh: Kerja Cerdas Tanpa Lembur"
                disabled={!canEdit || isPending}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Positioning Brand</label>
              <textarea
                rows={2}
                value={positioningStatement}
                onChange={(e) => setPositioningStatement(e.target.value)}
                placeholder="Untuk siapa brand ini hadir dan masalah utama apa yang dipecahkan..."
                disabled={!canEdit || isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Ringkasan Produk / Penawaran / Afiliasi</label>
              <textarea
                rows={2}
                value={offerSummary}
                onChange={(e) => setOfferSummary(e.target.value)}
                placeholder="Produk digital, layanan jasa, atau kategori afiliasi utama..."
                disabled={!canEdit || isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Nilai Brand (pisahkan koma)</label>
              <Input
                value={valuesText}
                onChange={(e) => setValuesText(e.target.value)}
                placeholder="transparan, berbasis praktik, ramah pemula"
                disabled={!canEdit || isPending}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Aturan Gaya Bahasa (pisahkan koma)</label>
              <Input
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                placeholder="sapaan Aku-Kamu, kalimat ringkas, hindari istilah asing rumit"
                disabled={!canEdit || isPending}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-border/60 pt-3">
          <Button type="submit" size="sm" variant="outline" disabled={!canEdit || isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            <span>{isPending ? "Menyimpan..." : "Simpan Brand Context"}</span>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
