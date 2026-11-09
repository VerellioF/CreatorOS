import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { StrategyService } from "@/services/strategy-service";
import { ContentEngineService } from "@/services/content-engine-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BeginnerGuideCard } from "@/features/creator-intelligence/components/beginner-guide-card";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  FileText,
  Compass,
  Layers,
  Calendar,
  Dna,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const [profile, workspaces, activeWorkspaceId] = await Promise.all([
    ProfileService.getProfile(user.id),
    WorkspaceService.getWorkspacesForUser(user.id),
    getValidatedActiveWorkspaceId(),
  ]);

  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const [creatorContext, strategies, contentPackages] = currentWorkspace
    ? await Promise.all([
        CreatorContextService.getWorkspaceCreatorContext(
          currentWorkspace.id,
          user.id
        ),
        StrategyService.listStrategiesWithPillars(currentWorkspace.id, user.id),
        ContentEngineService.listContentPackages(currentWorkspace.id, user.id),
      ])
    : [null, [], []];

  const activeStrategy =
    strategies.find((s) => s.isActive) ?? strategies[0] ?? null;
  const activePillars = activeStrategy?.pillars ?? [];

  const userName =
    profile?.full_name || user?.email?.split("@")[0] || "Creator";
  const creatorMode = currentWorkspace?.creator_mode || "creator";

  const modeLabels: Record<string, string> = {
    creator: "Creator Mode (Audience Growth)",
    affiliate: "Affiliate Mode (Review & Conversion)",
    business: "Business Mode (Brand Marketing)",
    personal_brand: "Personal Brand Mode (Expertise & Authority)",
  };

  const hasDna = Boolean(creatorContext?.creatorDna);
  const hasSelectedNiche = Boolean(creatorContext?.selectedNiche);
  const roadmapTasks = creatorContext?.roadmap30Days.flatMap((w) => w.tasks) ?? [];
  const completedRoadmapTasks = roadmapTasks.filter((t) => t.completed).length;

  const onboardingSteps = [
    {
      id: "profile",
      title: "Wawancara Onboarding Adaptif & Creator DNA",
      description:
        "Sintesiskan arketipe konten, tone of voice, persona audiens, dan roadmap 30 hari.",
      href: "/creator-profile",
      completed: Boolean(profile?.onboarding_completed || hasDna),
      isComingSoon: false,
    },
    {
      id: "niche",
      title: "Validasi & Pilih Niche Utama",
      description:
        "Bandingkan peluang konten, kompetisi kualitatif, dan pilih niche utama workspace.",
      href: "/niche-discovery",
      completed: hasSelectedNiche,
      isComingSoon: false,
    },
    {
      id: "strategy",
      title: "Buat Pilar Konten & Riset Berbasis Bukti",
      description:
        "Rancang positioning konten dan pilar strategi berbasis laporan riset terverifikasi.",
      href: "/strategy",
      completed: activePillars.length > 0,
      isComingSoon: false,
    },
    {
      id: "script",
      title: "Tulis & Adaptasikan Paket Naskah Platform",
      description:
        "Hasilkan dan sunting hooks, script, caption, CTA, hashtag, serta adaptasi lintas platform.",
      href: "/studio/scripts",
      completed: contentPackages.length > 0,
      isComingSoon: false,
    },
  ];

  const completedCount = onboardingSteps.filter((s) => s.completed).length;
  const progressPercent = Math.round(
    (completedCount / onboardingSteps.length) * 100
  );

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. Welcome Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Selamat Datang, {userName}!
            </h1>
            <Badge variant="outline" className="capitalize text-xs font-semibold">
              {modeLabels[creatorMode] || creatorMode}
            </Badge>
            {profile?.is_superadmin ? (
              <Badge variant="outline" className="text-xs font-semibold border-amber-500/40 bg-amber-500/10 text-amber-500 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Superadmin
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs font-semibold gap-1 text-primary">
                <Sparkles className="h-3 w-3" /> Akun Kreator Beta
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Workspace:{" "}
            <span className="font-semibold text-foreground">
              {currentWorkspace?.name}
            </span>
            . Mari bangun konsistensi kreasi konten Anda secara terukur.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {profile?.is_superadmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 shadow-xs">
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Console</span>
              </Button>
            </Link>
          )}
          <Link href="/creator-profile">
            <Button size="sm" className="gap-1.5 shadow-sm">
              <Sparkles className="h-4 w-4" />
              <span>
                {hasDna ? "Kelola Creator DNA" : "Mulai Onboarding Creator"}
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Missing Workspace / Database Migration Alert */}
      {!currentWorkspace && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-foreground space-y-2 animate-in fade-in-50">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>Database Supabase Belum Dimigrasi / Ruang Kerja Belum Ditemukan</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Aplikasi mendeteksi belum ada tabel <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">public.workspaces</code> di project Supabase Anda. Seluruh halaman studio, riset, dan strategi memerlukan ruang kerja aktif sehingga Anda otomatis diarahkan kembali ke dashboard sebelum database siap.
          </p>
          <div className="text-xs pt-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">Solusi:</span>
            <span className="text-muted-foreground">Terapkan migrasi database agar seluruh fitur menu dapat menyimpan dan memproses data Anda.</span>
          </div>
        </div>
      )}

      {/* Beginner Quickstart Guide */}
      <BeginnerGuideCard
        hasDna={hasDna}
        hasNiche={hasSelectedNiche}
        hasPillars={activePillars.length > 0}
        hasScripts={contentPackages.length > 0}
      />

      {/* 2. Setup Progress & Active Creator Intelligence Card */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Creator Setup Progress
                </CardTitle>
                <CardDescription className="text-xs">
                  Fondasi Creator Intelligence digunakan ulang secara otomatis di seluruh modul AI.
                </CardDescription>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                {progressPercent}% Selesai
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(progressPercent, 5)}%` }}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2">
            {onboardingSteps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-start justify-between p-3 rounded-lg border border-border/40 bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {idx + 1}. {step.title}
                      </span>
                      {step.isComingSoon && (
                        <Badge variant="comingSoon" className="text-[9px] px-1.5 py-0">
                          Fase 3+
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>

                {!step.isComingSoon ? (
                  <Link href={step.href}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <span>Buka</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic px-2 py-1">
                    Segera Hadir
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active Creator DNA / Niche Quick Card */}
        <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent flex flex-col justify-between">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
              {hasDna ? (
                <Dna className="h-5 w-5" />
              ) : (
                <Compass className="h-5 w-5" />
              )}
            </div>
            <CardTitle className="text-base font-semibold">
              {creatorContext?.creatorDna
                ? creatorContext.creatorDna.creatorName
                : "Niche Discovery Engine"}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {creatorContext?.creatorDna ? (
                <>
                  <strong>Niche Utama:</strong>{" "}
                  {creatorContext.creatorDna.primaryNiche}
                  <br />
                  <strong>Arketipe:</strong>{" "}
                  {creatorContext.creatorDna.personalityArchetype}
                  {roadmapTasks.length > 0 && (
                    <>
                      <br />
                      <strong>Roadmap 30 Hari:</strong> {completedRoadmapTasks}/
                      {roadmapTasks.length} tugas selesai
                    </>
                  )}
                </>
              ) : (
                "Temukan ceruk konten yang selaras dengan minat, keahlian, ketersediaan waktu, dan potensi monetisasi realistis Anda."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={hasDna ? "/niche-discovery" : "/creator-profile"}>
              <Button variant="default" size="sm" className="w-full gap-2 text-xs">
                <span>
                  {hasDna ? "Eksplorasi & Pilih Niche" : "Mulai Wawancara Adaptif"}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 3. Operational Overview */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          Aktivitas Konten Workspace
        </h3>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-semibold">
                  Naskah Terakhir
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {contentPackages.length > 0 ? (
                <div className="space-y-2 text-xs p-2">
                  <div className="font-semibold text-foreground line-clamp-1">
                    {contentPackages[0].title}
                  </div>
                  <p className="text-muted-foreground text-[11px] uppercase">
                    Platform: {contentPackages[0].primaryPlatform} ·{" "}
                    {contentPackages.length} total paket
                  </p>
                  <Link href="/studio/scripts">
                    <Button variant="outline" size="sm" className="text-xs mt-1">
                      Buka Script Studio
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <EmptyState
                    title="Belum Ada Naskah"
                    description="Buat paket konten (hook, naskah, caption, CTA, hashtag) di Script Studio."
                    className="p-4"
                  />
                  <div className="px-4 pb-2">
                    <Link href="/studio/scripts">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Buka Script Studio
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-semibold">
                  Pilar Strategi
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {activePillars.length > 0 ? (
                <div className="space-y-2 text-xs p-2">
                  <div className="font-semibold text-foreground">
                    {activePillars.length} pilar aktif
                  </div>
                  <p className="text-muted-foreground text-[11px] line-clamp-2">
                    {activePillars.map((p) => p.name).join(" · ")}
                  </p>
                  <Link href="/strategy">
                    <Button variant="outline" size="sm" className="text-xs mt-1">
                      Kelola Pilar
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <EmptyState
                    title="Belum Ada Pilar"
                    description="Rancang pilar konten yang dapat disunting di modul Content Strategy."
                    className="p-4"
                  />
                  <div className="px-4 pb-2">
                    <Link href="/strategy">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        Buat Strategi
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-semibold">
                  Roadmap 30 Hari
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {roadmapTasks.length > 0 ? (
                <div className="space-y-2 text-xs p-2">
                  <div className="font-semibold text-foreground">
                    {completedRoadmapTasks} dari {roadmapTasks.length} aksi selesai
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Minggu 1: {creatorContext?.roadmap30Days[0]?.theme}
                  </p>
                  <Link href="/creator-profile">
                    <Button variant="outline" size="sm" className="text-xs mt-1">
                      Buka Roadmap
                    </Button>
                  </Link>
                </div>
              ) : (
                <EmptyState
                  title="Roadmap Belum Dibuat"
                  description="Selesaikan onboarding di Creator Profile untuk menyimpan roadmap 30 hari."
                  className="p-4"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
