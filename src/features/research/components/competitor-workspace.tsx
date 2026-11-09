"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Users2,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Coins,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteCompetitorProfileAction,
  generateResearchReportAction,
  saveCompetitorProfileAction,
} from "@/features/research/actions";
import { ResearchDossierCard } from "./research-dossier-card";
import type {
  HydratedCompetitorProfile,
  HydratedResearchReport,
} from "@/services/research-service";
import type { SocialPlatformId } from "@/lib/supabase/types";

interface CompetitorWorkspaceProps {
  workspaceId: string;
  defaultNiche: string;
  initialCompetitors: HydratedCompetitorProfile[];
  initialCompetitorReports: HydratedResearchReport[];
  canEdit: boolean;
  aiConfigured: boolean;
  creditBalance: number;
}

export function CompetitorWorkspace({
  workspaceId,
  defaultNiche,
  initialCompetitors,
  initialCompetitorReports,
  canEdit,
  aiConfigured,
  creditBalance,
}: CompetitorWorkspaceProps) {
  const [competitors, setCompetitors] = React.useState(initialCompetitors);
  const [reports, setReports] = React.useState(initialCompetitorReports);
  const [credits, setCredits] = React.useState(creditBalance);
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);

  const [handle, setHandle] = React.useState("");
  const [platform, setPlatform] = React.useState<SocialPlatformId>("tiktok");
  const [profileUrl, setProfileUrl] = React.useState("");
  const [followerText, setFollowerText] = React.useState("");
  const [positioningSummary, setPositioningSummary] = React.useState("");
  const [hooksText, setHooksText] = React.useState("");
  const [topicsText, setTopicsText] = React.useState("");
  const [gapsText, setGapsText] = React.useState("");
  const [evidenceNotes, setEvidenceNotes] = React.useState("");

  const [analysisQuery, setAnalysisQuery] = React.useState(
    defaultNiche || "Analisis celah konten kompetitor"
  );
  const [isPending, startTransition] = React.useTransition();

  const resetForm = () => {
    setEditingId(undefined);
    setHandle("");
    setProfileUrl("");
    setFollowerText("");
    setPositioningSummary("");
    setHooksText("");
    setTopicsText("");
    setGapsText("");
    setEvidenceNotes("");
  };

  const loadForEdit = (c: HydratedCompetitorProfile) => {
    setEditingId(c.id);
    setHandle(c.handle);
    setPlatform(c.platform);
    setProfileUrl(c.profileUrl ?? "");
    setFollowerText(
      c.followerCountEstimate !== null ? String(c.followerCountEstimate) : ""
    );
    setPositioningSummary(c.positioningSummary);
    setHooksText(c.observedHooks.map((h) => h.hookText).join("\n"));
    setTopicsText(c.topPerformingTopics.join(", "));
    setGapsText(c.contentGaps.join(", "));
    setEvidenceNotes(c.evidenceNotes);
  };

  const handleSaveCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFollowers =
      followerText.trim() === "" ? null : Number.parseInt(followerText.trim(), 10);

    startTransition(async () => {
      const res = await saveCompetitorProfileAction(workspaceId, {
        id: editingId,
        handle: handle.trim(),
        displayName: handle.trim(),
        platform,
        profileUrl: profileUrl.trim() || null,
        followerCountEstimate:
          parsedFollowers !== null && !Number.isNaN(parsedFollowers)
            ? parsedFollowers
            : null,
        positioningSummary,
        observedHooks: hooksText
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 3)
          .map((hookText) => ({ hookText, formatNote: "Pengamatan publik" })),
        topPerformingTopics: topicsText
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length >= 2),
        contentGaps: gapsText
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length >= 2),
        evidenceNotes,
        dataLimitations:
          "Berdasarkan pengamatan profil publik; metrik retensi internal akun tidak tersedia.",
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setCompetitors((prev) => {
        const exists = prev.some((item) => item.id === res.profile.id);
        return exists
          ? prev.map((item) => (item.id === res.profile.id ? res.profile : item))
          : [res.profile, ...prev];
      });
      resetForm();
      toast.success("Bukti kompetitor berhasil disimpan.");
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteCompetitorProfileAction(workspaceId, id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      toast.success("Kompetitor dihapus.");
    });
  };

  const handleGenerateCompetitorReport = () => {
    startTransition(async () => {
      const res = await generateResearchReportAction(workspaceId, {
        reportType: "competitor",
        topicQuery: analysisQuery.trim() || "Evaluasi diferensiasi kompetitor",
        targetPlatform: platform,
        referenceUrls: competitors
          .map((c) => c.profileUrl)
          .filter((u): u is string => Boolean(u))
          .slice(0, 5),
        competitorIds: competitors.map((c) => c.id).slice(0, 8),
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setReports((prev) => [res.report, ...prev]);
      setCredits(res.remainingCredits);
      toast.success("Laporan analisis kompetitor berbasis bukti selesai dibuat.");
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Competitor Evidence Form */}
        <Card className="lg:col-span-2 border-border/80">
          <form onSubmit={handleSaveCompetitor}>
            <CardHeader>
              <CardTitle className="text-base">
                {editingId ? "Edit Bukti Kompetitor" : "Catat Kompetitor & Bukti Publik"}
              </CardTitle>
              <CardDescription className="text-xs">
                Catat handle, URL publik, dan hook nyata yang Anda amati. Kosongkan jumlah pengikut jika belum diketahui (&quot;Belum ada data&quot;).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Handle Akun</label>
                  <Input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@namaakun"
                    disabled={!canEdit || isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as SocialPlatformId)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="threads">Threads</option>
                    <option value="x">X</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">URL Profil Publik (Opsional)</label>
                  <Input
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    placeholder="https://tiktok.com/@..."
                    disabled={!canEdit || isPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Estimasi Pengikut (Opsional)</label>
                  <Input
                    type="number"
                    min={0}
                    value={followerText}
                    onChange={(e) => setFollowerText(e.target.value)}
                    placeholder="Kosongkan jika belum ada data"
                    disabled={!canEdit || isPending}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Ringkasan Positioning Kompetitor</label>
                <Input
                  value={positioningSummary}
                  onChange={(e) => setPositioningSummary(e.target.value)}
                  placeholder="Contoh: Fokus review gadget gaming mid-range"
                  disabled={!canEdit || isPending}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Hook Nyata yang Teramati (1 per baris)</label>
                <textarea
                  rows={2}
                  value={hooksText}
                  onChange={(e) => setHooksText(e.target.value)}
                  placeholder="Contoh: Jangan beli HP 3 jutaan sebelum cek bagian layar ini..."
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Topik Utama (pisahkan koma)</label>
                  <Input
                    value={topicsText}
                    onChange={(e) => setTopicsText(e.target.value)}
                    placeholder="unboxing, tes baterai"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Celah Konten (pisahkan koma)</label>
                  <Input
                    value={gapsText}
                    onChange={(e) => setGapsText(e.target.value)}
                    placeholder="jarang bahas pemakaian 6 bulan"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Catatan Bukti Tambahan</label>
                <Input
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="Kolom komentar banyak menanyakan perbandingan kamera malam"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2 border-t border-border/60 pt-3">
              {editingId && (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Batal Edit
                </Button>
              )}
              <Button type="submit" size="sm" disabled={!canEdit || isPending} className="gap-1.5 ml-auto">
                <Plus className="h-3.5 w-3.5" />
                <span>{editingId ? "Simpan Perubahan" : "Simpan Bukti Kompetitor"}</span>
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Monitored Competitors + AI Analysis Trigger */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  Sintesis Analisis Kompetitor AI
                </CardTitle>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Coins className="h-3.5 w-3.5 text-primary" />
                  <span>2 Kredit (Saldo: {credits})</span>
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Menganalisis bukti kompetitor yang tercatat di bawah beserta pencarian publik tanpa mengarang metrik tersembunyi.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <Input
                value={analysisQuery}
                onChange={(e) => setAnalysisQuery(e.target.value)}
                placeholder="Fokus evaluasi kompetitor..."
                className="bg-background"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateCompetitorReport}
                disabled={!canEdit || !aiConfigured || isPending}
                className="gap-1.5 shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isPending ? "Menganalisis..." : "Buat Dossier Kompetitor"}</span>
              </Button>
            </CardContent>
          </Card>

          {competitors.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="Belum Ada Kompetitor Tercatat"
              description="Tambahkan minimal 1 kompetitor yang Anda amati untuk memetakan kekuatan hook dan celah diferensiasi."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {competitors.map((c) => (
                <Card key={c.id} className="border-border/70">
                  <CardContent className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{c.handle}</span>
                        <Badge variant="secondary" className="uppercase text-[10px]">
                          {c.platform}
                        </Badge>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => loadForEdit(c)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => handleDelete(c.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      Pengikut:{" "}
                      <strong className="text-foreground">
                        {c.followerCountEstimate !== null
                          ? c.followerCountEstimate.toLocaleString("id-ID")
                          : "Belum ada data"}
                      </strong>
                    </p>
                    {c.positioningSummary && <p>{c.positioningSummary}</p>}
                    {c.observedHooks.length > 0 && (
                      <p className="text-muted-foreground">
                        <strong>Hook:</strong> {c.observedHooks[0]?.hookText}
                      </p>
                    )}
                    {c.contentGaps.length > 0 && (
                      <p className="text-emerald-700 dark:text-emerald-300">
                        <strong>Celah:</strong> {c.contentGaps.join(", ")}
                      </p>
                    )}
                    {c.profileUrl && (
                      <a
                        href={c.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <span>Buka Profil Publik</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {reports.length > 0 && (
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold">
            Dossier Riset Kompetitor ({reports.length})
          </h3>
          {reports.map((rep) => (
            <ResearchDossierCard key={rep.id} report={rep} />
          ))}
        </div>
      )}
    </div>
  );
}
