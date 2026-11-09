"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  deleteContentPillarAction,
  upsertContentPillarAction,
} from "@/features/strategy/actions";
import type { HydratedContentPillar } from "@/services/strategy-service";
import type { PillarObjective } from "@/lib/supabase/types";

interface PillarEditorPanelProps {
  workspaceId: string;
  strategyId: string;
  pillars: HydratedContentPillar[];
  canEdit: boolean;
  onPillarsChange: (next: HydratedContentPillar[]) => void;
}

export function PillarEditorPanel({
  workspaceId,
  strategyId,
  pillars,
  canEdit,
  onPillarsChange,
}: PillarEditorPanelProps) {
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [objective, setObjective] = React.useState<PillarObjective>("educate");
  const [ratio, setRatio] = React.useState(25);
  const [topicsText, setTopicsText] = React.useState("");
  const [formatsText, setFormatsText] = React.useState("Video pendek 45 detik");
  const [colorCode, setColorCode] = React.useState("#4F46E5");
  const [isPending, startTransition] = React.useTransition();

  const totalRatio = pillars.reduce((acc, p) => acc + p.ratioPercentage, 0);

  const resetForm = () => {
    setEditingId(undefined);
    setName("");
    setDescription("");
    setObjective("educate");
    setRatio(25);
    setTopicsText("");
    setFormatsText("Video pendek 45 detik");
    setColorCode("#4F46E5");
  };

  const startEdit = (p: HydratedContentPillar) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description);
    setObjective(p.objective);
    setRatio(p.ratioPercentage);
    setTopicsText(p.exampleTopics.join(", "));
    setFormatsText(p.recommendedFormats.join(", "));
    setColorCode(p.colorCode || "#4F46E5");
  };

  const handleSavePillar = (e: React.FormEvent) => {
    e.preventDefault();
    const exampleTopics = topicsText
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    const recommendedFormats = formatsText
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length >= 2);

    if (exampleTopics.length < 2) {
      toast.error("Masukkan minimal 2 contoh topik yang dipisahkan tanda koma.");
      return;
    }

    startTransition(async () => {
      const res = await upsertContentPillarAction(workspaceId, {
        id: editingId,
        strategyId,
        name: name.trim(),
        description: description.trim(),
        objective,
        ratioPercentage: Number(ratio),
        exampleTopics,
        recommendedFormats:
          recommendedFormats.length > 0 ? recommendedFormats : ["Video Pendek"],
        colorCode,
        sortOrder: editingId
          ? pillars.findIndex((p) => p.id === editingId)
          : pillars.length,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      const exists = pillars.some((p) => p.id === res.pillar.id);
      const next = exists
        ? pillars.map((p) => (p.id === res.pillar.id ? res.pillar : p))
        : [...pillars, res.pillar];
      onPillarsChange(next);
      resetForm();
      toast.success("Pilar konten berhasil disimpan.");
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteContentPillarAction(workspaceId, id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onPillarsChange(pillars.filter((p) => p.id !== id));
      toast.success("Pilar konten dihapus.");
    });
  };

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              Matriks Pilar Konten ({pillars.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Anda dapat mengedit nama, proporsi persentase, tujuan funnel, dan contoh topik tiap pilar kapan saja.
            </CardDescription>
          </div>
          <Badge variant={totalRatio === 100 ? "success" : "outline"}>
            Total Alokasi: {totalRatio}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {pillars.map((pillar) => (
            <div
              key={pillar.id}
              className="rounded-lg border border-border/70 p-3.5 space-y-2 text-xs bg-background/60"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: pillar.colorCode }}
                  />
                  <span className="font-bold text-sm">{pillar.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">{pillar.ratioPercentage}%</Badge>
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {pillar.objective}
                  </Badge>
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(pillar)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDelete(pillar.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground">{pillar.description}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {pillar.exampleTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="rounded bg-muted px-2 py-0.5 text-[11px] text-foreground/85"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <form
            onSubmit={handleSavePillar}
            className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/15"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">
                {editingId ? "Edit Pilar Konten" : "Tambah Pilar Konten Baru"}
              </span>
              {editingId && (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Batal
                </Button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-medium">Nama Pilar</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Bedah Studi Kasus Nyata"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Tujuan (Objective)</label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value as PillarObjective)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="educate">Educate (Edukasi)</option>
                  <option value="trust">Trust (Kredibilitas)</option>
                  <option value="engage">Engage (Interaksi)</option>
                  <option value="convert">Convert (Konversi)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Proporsi (%)</label>
                <Input
                  type="number"
                  min={5}
                  max={100}
                  value={ratio}
                  onChange={(e) => setRatio(Number(e.target.value))}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Deskripsi Pilar</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan sudut pandang dan manfaat pilar ini untuk audiens..."
                disabled={isPending}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Contoh Topik (minimal 2, pisahkan koma)
                </label>
                <Input
                  value={topicsText}
                  onChange={(e) => setTopicsText(e.target.value)}
                  placeholder="Cara atur jadwal fokus, Kesalahan manajemen waktu"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Format Rekomendasi (pisahkan koma)</label>
                <Input
                  value={formatsText}
                  onChange={(e) => setFormatsText(e.target.value)}
                  placeholder="Talking head 45s, Carousel 6 slide"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                {editingId ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{editingId ? "Simpan Pilar" : "Tambah Pilar"}</span>
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
