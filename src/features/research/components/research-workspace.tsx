"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  Users,
  Sparkles,
  ShieldAlert,
  Coins,
  Search,
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
import { generateResearchReportAction } from "@/features/research/actions";
import { ResearchDossierCard } from "./research-dossier-card";
import type { HydratedResearchReport } from "@/services/research-service";
import type { WorkspaceCreatorContext } from "@/lib/ai/context-builder";
import type { SocialPlatformId } from "@/lib/supabase/types";

interface ResearchWorkspaceProps {
  context: WorkspaceCreatorContext;
  initialReports: HydratedResearchReport[];
  canEdit: boolean;
  aiConfigured: boolean;
  creditBalance: number;
}

export function ResearchWorkspace({
  context,
  initialReports,
  canEdit,
  aiConfigured,
  creditBalance,
}: ResearchWorkspaceProps) {
  const [reports, setReports] = React.useState<HydratedResearchReport[]>(initialReports);
  const [credits, setCredits] = React.useState(creditBalance);
  const [reportType, setReportType] = React.useState<"trend" | "audience">("trend");
  const [topicQuery, setTopicQuery] = React.useState(
    context.selectedNiche?.nicheTitle || context.creatorDna?.primaryNiche || ""
  );
  const [targetPlatform, setTargetPlatform] = React.useState<SocialPlatformId>(
    (context.creatorDna?.primaryPlatforms?.[0] as SocialPlatformId) || "tiktok"
  );
  const [referenceUrlsText, setReferenceUrlsText] = React.useState("");
  const [filterType, setFilterType] = React.useState<"all" | "trend" | "audience">("all");
  const [isPending, startTransition] = React.useTransition();

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicQuery.trim()) {
      toast.error("Masukkan topik atau kata kunci riset terlebih dahulu.");
      return;
    }

    const referenceUrls = referenceUrlsText
      .split(/\r?\n|,/)
      .map((u) => u.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await generateResearchReportAction(context.workspaceId, {
        reportType,
        topicQuery: topicQuery.trim(),
        targetPlatform,
        referenceUrls,
        competitorIds: [],
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setReports((prev) => [res.report, ...prev]);
      setCredits(res.remainingCredits);
      toast.success(
        `Laporan riset berhasil disusun (${res.report.sources.length} sumber tercatat).`
      );
    });
  };

  const filteredReports = reports.filter((r) =>
    filterType === "all" ? r.reportType !== "competitor" : r.reportType === filterType
  );

  return (
    <div className="space-y-6">
      {!aiConfigured && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Konfigurasi AI Provider Diperlukan:</strong> Isi{" "}
            <code>GEMINI_API_KEY</code> (mendukung Google Search Grounding langsung) atau{" "}
            <code>OPENAI_API_KEY</code> pada <code>.env.local</code> untuk menjalankan sintesis riset otomatis.
          </div>
        </div>
      )}

      <Card className="border-border/80">
        <form onSubmit={handleGenerate}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={reportType === "trend" ? "default" : "outline"}
                  onClick={() => setReportType("trend")}
                  className="gap-1.5"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Trend Research</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={reportType === "audience" ? "default" : "outline"}
                  onClick={() => setReportType("audience")}
                  className="gap-1.5"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Audience Research</span>
                </Button>
              </div>
              <Badge variant="outline" className="gap-1.5 text-xs">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span>Biaya: 2 Kredit (Saldo: {credits})</span>
              </Badge>
            </div>
            <CardTitle className="text-base pt-2">
              {reportType === "trend"
                ? "Riset Tren & Peluang Topik Berbasis Bukti"
                : "Riset Psikografi, Pertanyaan & Kebutuhan Audiens"}
            </CardTitle>
            <CardDescription className="text-xs">
              Mengambil tajuk berita publik RSS, URL referensi Anda, dan Google Search Grounding (bila aktif), serta memisahkan fakta terverifikasi dari interpretasi AI.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium">Topik / Kueri Riset</label>
                <Input
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  placeholder="Contoh: produktivitas kerja remote Indonesia, skincare basic kulit berminyak..."
                  disabled={!canEdit || isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Platform Fokus</label>
                <select
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value as SocialPlatformId)}
                  disabled={!canEdit || isPending}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="threads">Threads</option>
                  <option value="x">X (Twitter)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                URL Sumber Referensi Tambahan (Opsional — 1 URL publik per baris, maks 5)
              </label>
              <textarea
                rows={2}
                value={referenceUrlsText}
                onChange={(e) => setReferenceUrlsText(e.target.value)}
                placeholder="https://... (tempel tautan artikel, laporan industri, atau halaman publik untuk diekstrak dan disitasi)"
                disabled={!canEdit || isPending}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-[11px] text-muted-foreground">
              Zero Fabricated Statistics: Sistem otomatis menolak URL fiktif & klaim tanpa rujukan.
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={!canEdit || !aiConfigured || isPending}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {isPending ? "Mengumpulkan Sumber & Menganalisis..." : "Jalankan Riset (2 Kredit)"}
              </span>
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Filter & Dossier History */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Riwayat Dossier Riset ({filteredReports.length})
        </h3>
        <div className="flex items-center gap-1.5">
          {(["all", "trend", "audience"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={filterType === tab ? "secondary" : "ghost"}
              onClick={() => setFilterType(tab)}
              className="h-7 text-xs capitalize"
            >
              {tab === "all" ? "Semua" : tab}
            </Button>
          ))}
        </div>
      </div>

      {filteredReports.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Belum Ada Laporan Riset Tercatat"
          description="Jalankan Trend Research atau Audience Research di atas untuk menghasilkan laporan berbasis sumber lengkap dengan timestamp dan tingkat keyakinan."
        />
      ) : (
        <div className="space-y-6">
          {filteredReports.map((rep) => (
            <ResearchDossierCard key={rep.id} report={rep} />
          ))}
        </div>
      )}
    </div>
  );
}
