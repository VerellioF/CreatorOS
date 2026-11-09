"use client";

import * as React from "react";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, AlertTriangle, Edit3, Bot } from "lucide-react";
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
import {
  generateAiAdaptiveQuestionsAction,
  saveAdaptiveAnswersAction,
  saveCoreOnboardingAction,
  synthesizeCreatorIntelligenceAction,
} from "@/features/creator-intelligence/actions";
import type { CreatorMode } from "@/lib/supabase/types";
import type {
  AdaptiveQuestionItem,
  OnboardingCoreAnswers,
} from "@/lib/validation/creator-intelligence-schemas";

interface OnboardingInterviewPanelProps {
  workspaceId: string;
  initialCreatorMode: CreatorMode;
  canEdit: boolean;
  aiConfigured: boolean;
  initialCoreAnswers: OnboardingCoreAnswers | null;
  initialAdaptiveQuestions: AdaptiveQuestionItem[];
  initialAdaptiveAnswers: Record<string, string>;
  onSynthesisComplete?: () => void;
}

const FORMAT_OPTIONS = [
  { id: "short_video_talking_head", label: "Video Pendek (Talking Head)" },
  { id: "short_video_faceless_broll", label: "Video Pendek Faceless / B-Roll" },
  { id: "carousel_and_microblog", label: "Carousel & Microblog" },
  { id: "long_form_educational_video", label: "Video Panjang Edukasi" },
  { id: "product_demo_and_review", label: "Demo & Review Produk" },
] as const;

const MONETIZATION_OPTIONS = [
  { id: "affiliate_commission", label: "Komisi Affiliate" },
  { id: "digital_products", label: "Produk Digital (E-book/Template/Kelas)" },
  { id: "services_and_consulting", label: "Jasa / Konsultasi" },
  { id: "brand_sponsorships", label: "Endorsement / Brand Deal" },
  { id: "own_business_sales", label: "Penjualan Produk Bisnis Sendiri" },
  { id: "undecided_explore_first", label: "Eksplorasi Bertahap" },
] as const;

const PLATFORM_OPTIONS = [
  "tiktok",
  "instagram",
  "youtube",
  "linkedin",
  "threads",
  "x",
] as const;

function parseCsvTags(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 12);
}

export function OnboardingInterviewPanel({
  workspaceId,
  initialCreatorMode,
  canEdit,
  aiConfigured,
  initialCoreAnswers,
  initialAdaptiveQuestions,
  initialAdaptiveAnswers,
  onSynthesisComplete,
}: OnboardingInterviewPanelProps) {
  const [creatorMode, setCreatorMode] = React.useState<CreatorMode>(
    initialCoreAnswers?.creatorMode ?? initialCreatorMode
  );
  const [interestsText, setInterestsText] = React.useState(
    initialCoreAnswers?.interests.join(", ") ?? ""
  );
  const [skillsText, setSkillsText] = React.useState(
    initialCoreAnswers?.skills.join(", ") ?? ""
  );
  const [experience, setExperience] = React.useState<
    OnboardingCoreAnswers["experience"]
  >(initialCoreAnswers?.experience ?? "complete_beginner");
  const [experienceNotes, setExperienceNotes] = React.useState(
    initialCoreAnswers?.experienceNotes ?? ""
  );
  const [availableTime, setAvailableTime] = React.useState<
    OnboardingCoreAnswers["availableTime"]
  >(initialCoreAnswers?.availableTime ?? "3_to_6_hours_weekly");
  const [availableEquipment, setAvailableEquipment] = React.useState<
    OnboardingCoreAnswers["availableEquipment"]
  >(initialCoreAnswers?.availableEquipment ?? "smartphone_only");
  const [equipmentNotes, setEquipmentNotes] = React.useState(
    initialCoreAnswers?.equipmentNotes ?? ""
  );
  const [preferredFormats, setPreferredFormats] = React.useState<
    OnboardingCoreAnswers["preferredContentFormat"]
  >(initialCoreAnswers?.preferredContentFormat ?? ["short_video_talking_head"]);
  const [primaryPlatforms, setPrimaryPlatforms] = React.useState<
    OnboardingCoreAnswers["primaryPlatforms"]
  >(initialCoreAnswers?.primaryPlatforms ?? ["tiktok", "instagram"]);
  const [targetAudience, setTargetAudience] = React.useState(
    initialCoreAnswers?.targetAudience ?? ""
  );
  const [goals, setGoals] = React.useState(initialCoreAnswers?.goals ?? "");
  const [monetizationPrefs, setMonetizationPrefs] = React.useState<
    OnboardingCoreAnswers["monetizationPreferences"]
  >(initialCoreAnswers?.monetizationPreferences ?? ["affiliate_commission"]);

  const [adaptiveQuestions, setAdaptiveQuestions] = React.useState<
    AdaptiveQuestionItem[]
  >(initialAdaptiveQuestions);
  const [adaptiveAnswers, setAdaptiveAnswers] = React.useState<
    Record<string, string>
  >(initialAdaptiveAnswers);
  const [coachSummary, setCoachSummary] = React.useState<string>("");

  const [isSavingCore, setIsSavingCore] = React.useState(false);
  const [isGeneratingAiQ, setIsGeneratingAiQ] = React.useState(false);
  const [isSavingAdaptive, setIsSavingAdaptive] = React.useState(false);
  const [isSynthesizing, setIsSynthesizing] = React.useState(false);

  const toggleArrayItem = <T extends string>(
    list: T[],
    item: T,
    setter: (next: T[]) => void
  ) => {
    if (list.includes(item)) {
      if (list.length > 1) setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleSaveCore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setIsSavingCore(true);
    try {
      const res = await saveCoreOnboardingAction(workspaceId, {
        creatorMode,
        interests: parseCsvTags(interestsText),
        skills: parseCsvTags(skillsText),
        experience,
        experienceNotes,
        availableTime,
        availableEquipment,
        equipmentNotes,
        preferredContentFormat: preferredFormats,
        primaryPlatforms,
        targetAudience,
        goals,
        monetizationPreferences: monetizationPrefs,
      });
      if (res.success) {
        setAdaptiveQuestions(res.adaptiveQuestions);
        toast.success("Jawaban dasar disimpan & wawancara adaptif diperbarui!");
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsSavingCore(false);
    }
  };

  const handleGenerateAiQuestions = async () => {
    setIsGeneratingAiQ(true);
    try {
      const res = await generateAiAdaptiveQuestionsAction(workspaceId);
      if (res.success) {
        setCoachSummary(res.coachSummary);
        setAdaptiveQuestions(res.questions);
        toast.success(
          `Pertanyaan adaptif AI dibuat (${res.totalTokens} token, sisa ${res.remainingCredits} kredit)`
        );
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsGeneratingAiQ(false);
    }
  };

  const handleSaveAdaptive = async () => {
    setIsSavingAdaptive(true);
    try {
      const res = await saveAdaptiveAnswersAction(workspaceId, adaptiveAnswers);
      if (res.success) {
        toast.success("Jawaban wawancara lanjutan berhasil disimpan!");
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsSavingAdaptive(false);
    }
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    try {
      await saveAdaptiveAnswersAction(workspaceId, adaptiveAnswers);
      const res = await synthesizeCreatorIntelligenceAction(workspaceId);
      if (res.success) {
        toast.success(
          `Creator DNA & Roadmap 30 Hari selesai disusun! (Sisa ${res.remainingCredits} kredit)`
        );
        onSynthesisComplete?.();
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {!aiConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Konfigurasi API Key AI Diperlukan untuk Sintesis Otomatis</p>
            <p className="mt-0.5 opacity-90">
              Seluruh jawaban wawancara dan penyuntingan Creator DNA tetap tersimpan penuh ke database. Untuk mengaktifkan sintesis AI otomatis (Gemini 3.8 / OpenAI), isi <code>GEMINI_API_KEY</code> atau <code>OPENAI_API_KEY</code> pada <code>.env.local</code>.
            </p>
          </div>
        </div>
      )}

      {/* STEP 1: 9 Core Onboarding Dimensions + Creator Mode */}
      <Card>
        <form onSubmit={handleSaveCore}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Tahap 1: Profil Dasar & Mode Kreator (Dapat Diedit Kapan Saja)
                </CardTitle>
                <CardDescription className="text-xs">
                  Isi 9 dimensi utama kreator agar wawancara adaptif dan strategi konten selaras dengan kapasitas nyata Anda.
                </CardDescription>
              </div>
              {initialCoreAnswers && (
                <Badge variant="success" className="gap-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3" /> Tersimpan
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="font-semibold block mb-1">1. Creator Mode</label>
                <select
                  value={creatorMode}
                  disabled={!canEdit}
                  onChange={(e) => setCreatorMode(e.target.value as CreatorMode)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="creator">Creator Mode (Audience Growth)</option>
                  <option value="affiliate">Affiliate Mode (Review & Komisi)</option>
                  <option value="business">Business Mode (Brand & Leads)</option>
                  <option value="personal_brand">Personal Brand Mode (Otoritas)</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">2. Pengalaman Konten</label>
                <select
                  value={experience}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setExperience(e.target.value as OnboardingCoreAnswers["experience"])
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="complete_beginner">Pemula Baru Mulai</option>
                  <option value="inconsistent_creator">Pernah Upload tapi Belum Konsisten</option>
                  <option value="consistent_creator">Sudah Rutin Membuat Konten</option>
                  <option value="subject_matter_expert">Praktisi/Ahli di Bidangnya</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">3. Waktu Tersedia / Minggu</label>
                <select
                  value={availableTime}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setAvailableTime(
                      e.target.value as OnboardingCoreAnswers["availableTime"]
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="under_3_hours_weekly">Kurang dari 3 jam / minggu</option>
                  <option value="3_to_6_hours_weekly">3 – 6 jam / minggu</option>
                  <option value="7_to_14_hours_weekly">7 – 14 jam / minggu</option>
                  <option value="15_plus_hours_weekly">15+ jam / minggu (Fokus Penuh)</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="font-semibold block mb-1">
                  4. Minat Utama (pisahkan dengan koma)
                </label>
                <Input
                  value={interestsText}
                  disabled={!canEdit}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="Contoh: Keuangan pribadi, AI produktivitas, buku bisnis"
                  required
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">
                  5. Keahlian / Skill (pisahkan dengan koma)
                </label>
                <Input
                  value={skillsText}
                  disabled={!canEdit}
                  onChange={(e) => setSkillsText(e.target.value)}
                  placeholder="Contoh: Analisis data Excel, bercerita runtut, desain Canva"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="font-semibold block mb-1">6. Peralatan Produksi</label>
                <select
                  value={availableEquipment}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setAvailableEquipment(
                      e.target.value as OnboardingCoreAnswers["availableEquipment"]
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="smartphone_only">Smartphone Saja</option>
                  <option value="smartphone_with_basic_audio_light">
                    Smartphone + Clip Mic / Ring Light
                  </option>
                  <option value="camera_and_desktop_setup">
                    Kamera Mirrorless/DSLR + PC Editing
                  </option>
                  <option value="laptop_screen_faceless_only">
                    Laptop Screen-Recording / Faceless Saja
                  </option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">
                  Catatan Pengalaman / Alat (Opsional)
                </label>
                <Input
                  value={equipmentNotes || experienceNotes}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setEquipmentNotes(e.target.value);
                    setExperienceNotes(e.target.value);
                  }}
                  placeholder="Contoh: Pakai HP Android menengah & CapCut"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1.5">7. Format Konten Pilihan</label>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((fmt) => {
                  const active = preferredFormats.includes(fmt.id);
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        toggleArrayItem(preferredFormats, fmt.id, setPreferredFormats)
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1.5">Platform Distribusi Utama</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((plat) => {
                  const active = primaryPlatforms.includes(plat);
                  return (
                    <button
                      key={plat}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        toggleArrayItem(primaryPlatforms, plat, setPrimaryPlatforms)
                      }
                      className={`rounded-full border px-3 py-1 text-xs uppercase transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {plat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="font-semibold block mb-1">8. Target Audiens</label>
                <textarea
                  value={targetAudience}
                  disabled={!canEdit}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  rows={2}
                  required
                  placeholder="Contoh: Karyawan muda usia 22-30 tahun di kota besar yang ingin mengatur gaji dan kerja lebih produktif"
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">
                  9. Tujuan Utama 30–90 Hari
                </label>
                <textarea
                  value={goals}
                  disabled={!canEdit}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={2}
                  required
                  placeholder="Contoh: Konsisten upload 3x seminggu dan membangun audiens yang percaya untuk rekomendasi produk"
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1.5">
                10. Preferensi Jalur Monetisasi
              </label>
              <div className="flex flex-wrap gap-2">
                {MONETIZATION_OPTIONS.map((opt) => {
                  const active = monetizationPrefs.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        toggleArrayItem(
                          monetizationPrefs,
                          opt.id,
                          setMonetizationPrefs
                        )
                      }
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
          {canEdit && (
            <CardFooter className="border-t border-border pt-4 flex justify-between">
              <span className="text-[11px] text-muted-foreground">
                Menyimpan akan menyesuaikan pertanyaan wawancara adaptif di Tahap 2.
              </span>
              <Button type="submit" size="sm" isLoading={isSavingCore} className="gap-1.5">
                <Edit3 className="h-3.5 w-3.5" />
                <span>Simpan Jawaban Dasar</span>
              </Button>
            </CardFooter>
          )}
        </form>
      </Card>

      {/* STEP 2: Adaptive Interview Questions */}
      {adaptiveQuestions.length > 0 && (
        <Card className="border-primary/25">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <span>Tahap 2: Wawancara Lanjutan Adaptif</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Pertanyaan di bawah ini beradaptasi otomatis dengan mode, alat, dan tujuan Anda.
                </CardDescription>
              </div>
              {canEdit && aiConfigured && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={isGeneratingAiQ}
                  onClick={handleGenerateAiQuestions}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Perdalam Pertanyaan via AI (1 Kredit)</span>
                </Button>
              )}
            </div>
            {coachSummary && (
              <div className="mt-2 rounded-md bg-primary/5 border border-primary/20 p-3 text-xs text-foreground">
                <span className="font-semibold text-primary">Catatan AI Coach: </span>
                {coachSummary}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {adaptiveQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-lg border border-border/70 bg-card/60 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="text-xs font-semibold text-foreground">
                    {idx + 1}. {q.question}
                  </label>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {q.targetDimension.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{q.whyItMatters}</p>
                {q.options && q.options.length > 0 && canEdit && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setAdaptiveAnswers((prev) => ({ ...prev, [q.id]: opt }))
                        }
                        className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] hover:bg-accent"
                      >
                        + {opt}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  value={adaptiveAnswers[q.id] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setAdaptiveAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  rows={2}
                  placeholder={q.placeholder}
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                />
              </div>
            ))}
          </CardContent>
          {canEdit && (
            <CardFooter className="border-t border-border pt-4 flex flex-wrap gap-3 justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isSavingAdaptive}
                onClick={handleSaveAdaptive}
              >
                Simpan Jawaban Wawancara
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!aiConfigured}
                isLoading={isSynthesizing}
                onClick={handleSynthesize}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Sintesis Creator DNA & Roadmap 30 Hari (3 Kredit)</span>
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}
