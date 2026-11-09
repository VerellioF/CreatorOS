"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Lightbulb,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  ArrowRight,
  Coins,
  Save,
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
  deleteContentIdeaAction,
  generateContentIdeasAction,
  saveContentIdeaAction,
} from "@/features/content-engine/actions";
import type { HydratedContentIdea } from "@/services/content-engine-service";
import type { HydratedContentPillar } from "@/services/strategy-service";
import type { HydratedResearchReport } from "@/services/research-service";
import type {
  ContentIdeaAngle,
  ContentIdeaStatus,
  SocialPlatformId,
} from "@/lib/supabase/types";

interface IdeasWorkspaceProps {
  workspaceId: string;
  initialIdeas: HydratedContentIdea[];
  pillars: HydratedContentPillar[];
  reports: HydratedResearchReport[];
  canEdit: boolean;
  aiConfigured: boolean;
  creditBalance: number;
}

export function IdeasWorkspace({
  workspaceId,
  initialIdeas,
  pillars,
  reports,
  canEdit,
  aiConfigured,
  creditBalance,
}: IdeasWorkspaceProps) {
  const [ideas, setIdeas] = React.useState(initialIdeas);
  const [credits, setCredits] = React.useState(creditBalance);

  // AI Generator state
  const [genPlatform, setGenPlatform] = React.useState<SocialPlatformId>("tiktok");
  const [genPillarId, setGenPillarId] = React.useState<string>("");
  const [genReportId, setGenReportId] = React.useState<string>(reports[0]?.id ?? "");
  const [genCount, setGenCount] = React.useState(6);
  const [customFocus, setCustomFocus] = React.useState("");

  // Manual / Edit Idea state
  const [showEditor, setShowEditor] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | undefined>(undefined);
  const [title, setTitle] = React.useState("");
  const [hookConcept, setHookConcept] = React.useState("");
  const [angleType, setAngleType] = React.useState<ContentIdeaAngle>("curiosity");
  const [targetPlatform, setTargetPlatform] = React.useState<SocialPlatformId>("tiktok");
  const [status, setStatus] = React.useState<ContentIdeaStatus>("backlog");
  const [filterPlatform, setFilterPlatform] = React.useState<string>("all");
  const [isPending, startTransition] = React.useTransition();

  const openNewManual = () => {
    setEditingId(undefined);
    setTitle("");
    setHookConcept("");
    setAngleType("curiosity");
    setTargetPlatform(genPlatform);
    setStatus("backlog");
    setShowEditor(true);
  };

  const openEdit = (idea: HydratedContentIdea) => {
    setEditingId(idea.id);
    setTitle(idea.title);
    setHookConcept(idea.hookConcept);
    setAngleType(idea.angleType);
    setTargetPlatform(idea.targetPlatform);
    setStatus(idea.status);
    setShowEditor(true);
  };

  const handleGenerateAi = () => {
    startTransition(async () => {
      const res = await generateContentIdeasAction(workspaceId, {
        targetPlatform: genPlatform,
        count: genCount,
        pillarId: genPillarId || null,
        researchReportId: genReportId || null,
        customTopicFocus: customFocus.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setIdeas((prev) => [...res.ideas, ...prev]);
      setCredits(res.remainingCredits);
      toast.success(`${res.ideas.length} ide konten tersimpan ke backlog.`);
    });
  };

  const handleSaveManualOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveContentIdeaAction(workspaceId, {
        id: editingId,
        pillarId: genPillarId || null,
        researchReportId: genReportId || null,
        title: title.trim(),
        hookConcept: hookConcept.trim(),
        angleType,
        targetPlatform,
        opportunityScore: 78,
        opportunityRationale: "Disunting / ditambahkan langsung oleh kreator.",
        researchTrace: "Konteks langsung workspace",
        status,
      });

      if (!res.success) {
        toast.error(res.error);
        return;
      }

      setIdeas((prev) => {
        const exists = prev.some((i) => i.id === res.idea.id);
        return exists
          ? prev.map((i) => (i.id === res.idea.id ? res.idea : i))
          : [res.idea, ...prev];
      });
      setShowEditor(false);
      toast.success("Ide konten disimpan.");
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteContentIdeaAction(workspaceId, id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setIdeas((prev) => prev.filter((i) => i.id !== id));
      toast.success("Ide dihapus.");
    });
  };

  const visibleIdeas = ideas.filter((i) =>
    filterPlatform === "all" ? true : i.targetPlatform === filterPlatform
  );

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Idea Generator Berbasis Creator DNA & Bukti Riset
            </CardTitle>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span>2 Kredit / Batch (Saldo: {credits})</span>
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Menghasilkan ide dengan pemicu psikologi (Curiosity, Contrarian, Tutorial, Case Study, Story, Myth-Busting) yang langsung tersimpan dan dapat diedit.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Platform Target</label>
            <select
              value={genPlatform}
              onChange={(e) => setGenPlatform(e.target.value as SocialPlatformId)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="linkedin">LinkedIn</option>
              <option value="threads">Threads</option>
              <option value="x">X</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Pilar Konten</label>
            <select
              value={genPillarId}
              onChange={(e) => setGenPillarId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
              <option value="">Semua Pilar Aktif</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ratioPercentage}%)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Rujukan Riset</label>
            <select
              value={genReportId}
              onChange={(e) => setGenReportId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
              <option value="">Tanpa laporan spesifik</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Jumlah Ide (4-10)</label>
            <Input
              type="number"
              min={4}
              max={10}
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="bg-background"
            />
          </div>
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-medium">Arah Sudut Pandang (Opsional)</label>
            <Input
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              placeholder="Contoh: Fokus masalah pemula yang baru mulai minggu pertama..."
              className="bg-background"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-3">
          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={openNewManual} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Ide Manual</span>
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleGenerateAi}
            disabled={!canEdit || !aiConfigured || isPending}
            className="gap-1.5 ml-auto"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isPending ? "Menghasilkan Ide..." : "Hasilkan Ide AI (2 Kredit)"}</span>
          </Button>
        </CardFooter>
      </Card>

      {showEditor && (
        <Card className="border-primary/40">
          <form onSubmit={handleSaveManualOrEdit}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {editingId ? "Edit Ide Konten" : "Tambah Ide Konten Baru"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Sudut Psikologi</label>
                  <select
                    value={angleType}
                    onChange={(e) => setAngleType(e.target.value as ContentIdeaAngle)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="curiosity">Curiosity</option>
                    <option value="contrarian">Contrarian</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="case_study">Case Study</option>
                    <option value="story">Story</option>
                    <option value="myth_busting">Myth Busting</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Platform</label>
                  <select
                    value={targetPlatform}
                    onChange={(e) => setTargetPlatform(e.target.value as SocialPlatformId)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="threads">Threads</option>
                    <option value="x">X</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ContentIdeaStatus)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="in_production">In Production</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Judul Ide</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Konsep Hook Pembuka</label>
                <textarea
                  rows={2}
                  value={hookConcept}
                  onChange={(e) => setHookConcept(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t border-border/60 pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowEditor(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                <span>Simpan Ide</span>
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Filter & Idea Backlog Cards */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Backlog Ide Tersimpan ({visibleIdeas.length})</h3>
        <div className="flex flex-wrap gap-1">
          {["all", "tiktok", "instagram", "youtube", "linkedin", "threads", "x"].map((pf) => (
            <Button
              key={pf}
              size="sm"
              variant={filterPlatform === pf ? "secondary" : "ghost"}
              onClick={() => setFilterPlatform(pf)}
              className="h-7 text-xs uppercase"
            >
              {pf === "all" ? "Semua" : pf}
            </Button>
          ))}
        </div>
      </div>

      {visibleIdeas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Belum Ada Ide Konten"
          description="Hasilkan ide berbasis Creator DNA & riset di atas atau tambahkan ide manual ke backlog."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleIdeas.map((idea) => (
            <Card key={idea.id} className="border-border/80 flex flex-col justify-between">
              <CardContent className="p-4 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {idea.targetPlatform}
                    </Badge>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {idea.angleType.replace("_", " ")}
                    </Badge>
                    <Badge variant="success" className="text-[10px]">
                      Skor {idea.opportunityScore}
                    </Badge>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(idea)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDelete(idea.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-bold text-foreground">{idea.title}</h4>
                <p className="rounded-md bg-muted/40 p-2 text-foreground/90">
                  <strong>Hook:</strong> &ldquo;{idea.hookConcept}&rdquo;
                </p>
                {idea.opportunityRationale && (
                  <p className="text-muted-foreground">{idea.opportunityRationale}</p>
                )}
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t border-border/50 px-4 py-2.5">
                <span className="text-[11px] text-muted-foreground capitalize">
                  Status: {idea.status.replace("_", " ")}
                </span>
                <Link href={`/studio/scripts?ideaId=${idea.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary">
                    <span>Tulis Skrip</span>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
