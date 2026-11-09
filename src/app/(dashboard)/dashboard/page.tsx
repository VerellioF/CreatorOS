import * as React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { WorkspaceService } from "@/services/workspace-service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  TrendingUp,
  FileText,
  Compass,
  Layers,
  Calendar,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await AuthService.getCurrentUser();
  const profile = user ? await ProfileService.getProfile(user.id) : null;
  const workspaces = user ? await WorkspaceService.getWorkspacesForUser(user.id) : [];

  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get("active_workspace_id")?.value;
  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Creator";
  const creatorMode = currentWorkspace?.creator_mode || "creator";

  const modeLabels: Record<string, string> = {
    creator: "Creator Mode (Audience Growth)",
    affiliate: "Affiliate Mode (Review & Conversion)",
    business: "Business Mode (Brand Marketing)",
    personal_brand: "Personal Brand Mode (Expertise & Authority)",
  };

  // Real onboarding checklist items
  const onboardingSteps = [
    {
      id: "profile",
      title: "Lengkapi Profil & Creator DNA",
      description: "Tentukan tone of voice, kepribadian konten, dan topik utama Anda.",
      href: "/creator-profile",
      completed: profile?.onboarding_completed || false,
    },
    {
      id: "niche",
      title: "Validasi Niche & Target Audiens",
      description: "Temukan sweet spot niche dengan kompetisi seimbang dan demand tinggi.",
      href: "/niche-discovery",
      completed: false,
    },
    {
      id: "strategy",
      title: "Buat Pilar Konten Pertama",
      description: "Rancang 3-5 tema utama untuk menjaga konsistensi publikasi Anda.",
      href: "/strategy",
      completed: false,
      isComingSoon: true,
    },
    {
      id: "script",
      title: "Tulis Script dengan Framework Teruji",
      description: "Hasilkan naskah video pendek 30-60 detik dengan formula hook kuat.",
      href: "/studio/scripts",
      completed: false,
      isComingSoon: true,
    },
  ];

  const completedCount = onboardingSteps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / onboardingSteps.length) * 100);

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. Welcome Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Selamat Datang, {userName}! 👋
            </h1>
            <Badge variant="outline" className="capitalize text-xs font-semibold">
              {modeLabels[creatorMode] || creatorMode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Workspace: <span className="font-semibold text-foreground">{currentWorkspace?.name}</span>. Mari bangun konsistensi kreasi konten Anda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/creator-profile">
            <Button size="sm" className="gap-1.5 shadow-sm">
              <Sparkles className="h-4 w-4" />
              <span>Mulai Onboarding Creator</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Primary Recommended Action & Setup Progress */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Progress Card */}
        <Card className="md:col-span-2 border-border/80 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Creator Setup Progress</CardTitle>
                <CardDescription className="text-xs">
                  Selesaikan 4 langkah fondasi untuk mengaktifkan AI Creator Engine Anda.
                </CardDescription>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                {progressPercent}% Selesai
              </span>
            </div>
            {/* Progress Bar */}
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
                          Phase 2
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

        {/* Quick Launch Card */}
        <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
              <Compass className="h-5 w-5" />
            </div>
            <CardTitle className="text-base font-semibold">Niche Discovery</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Bingung mulai dari mana? Temukan niche yang sesuai dengan minat, keahlian, dan potensi monetisasi Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/niche-discovery">
              <Button variant="default" size="sm" className="w-full gap-2 text-xs">
                <span>Eksplorasi Niche</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* 3. Operational Overview & Activity Empty States (Rule 1 & 3 compliant) */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          Aktivitas Konten Workspace
        </h3>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Recent Scripts Empty State */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-semibold">Naskah Terakhir</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Belum Ada Naskah"
                description="Script Studio akan diaktifkan di Fase 4 untuk penulisan skrip otomatis."
                className="p-4"
              />
            </CardContent>
          </Card>

          {/* Content Strategy Empty State */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-semibold">Pilar Strategi</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Belum Ada Pilar"
                description="Pilar konten akan dirancang di Fase 3 bersama Strategist Agent."
                className="p-4"
              />
            </CardContent>
          </Card>

          {/* Publishing Calendar Empty State */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-xs font-semibold">Jadwal Publikasi</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <EmptyState
                title="Kalender Kosong"
                description="Jadwal publikasi multi-platform akan aktif di Fase 6."
                className="p-4"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
