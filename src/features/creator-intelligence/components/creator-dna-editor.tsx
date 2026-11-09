"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dna, Users, Save } from "lucide-react";
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
import { updateCreatorDnaAction } from "@/features/creator-intelligence/actions";
import type {
  AudiencePersona,
  CreatorDnaEditable,
} from "@/lib/validation/creator-intelligence-schemas";

interface CreatorDnaEditorProps {
  workspaceId: string;
  canEdit: boolean;
  initialDna: CreatorDnaEditable | null;
  initialPersona: AudiencePersona | null;
  fallbackName: string;
}

const ALL_PLATFORMS = [
  "tiktok",
  "instagram",
  "youtube",
  "linkedin",
  "threads",
  "x",
] as const;

function splitCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

export function CreatorDnaEditor({
  workspaceId,
  canEdit,
  initialDna,
  initialPersona,
  fallbackName,
}: CreatorDnaEditorProps) {
  const [creatorName, setCreatorName] = React.useState(
    initialDna?.creatorName ?? fallbackName
  );
  const [primaryNiche, setPrimaryNiche] = React.useState(
    initialDna?.primaryNiche ?? ""
  );
  const [secondaryNichesText, setSecondaryNichesText] = React.useState(
    initialDna?.secondaryNiches.join(", ") ?? ""
  );
  const [uvp, setUvp] = React.useState(
    initialDna?.uniqueValueProposition ?? ""
  );
  const [audienceSummary, setAudienceSummary] = React.useState(
    initialDna?.targetAudienceSummary ?? ""
  );
  const [archetype, setArchetype] = React.useState(
    initialDna?.personalityArchetype ?? "The Practical Mentor"
  );
  const [toneText, setToneText] = React.useState(
    initialDna?.toneOfVoice.join(", ") ?? "Edukatif, Jujur, Terstruktur"
  );
  const [strengthsText, setStrengthsText] = React.useState(
    initialDna?.strengths.join(", ") ?? ""
  );
  const [tabooText, setTabooText] = React.useState(
    initialDna?.tabooTopics.join(", ") ?? ""
  );
  const [platforms, setPlatforms] = React.useState<
    CreatorDnaEditable["primaryPlatforms"]
  >(initialDna?.primaryPlatforms ?? ["tiktok", "instagram"]);
  const [formatsText, setFormatsText] = React.useState(
    initialDna?.preferredFormats.join(", ") ?? "Video Pendek 45-60 Detik"
  );

  // Audience Persona Editable State
  const [personaName, setPersonaName] = React.useState(
    initialPersona?.personaName ?? ""
  );
  const [ageRange, setAgeRange] = React.useState(
    initialPersona?.ageRange ?? "21-32 tahun"
  );
  const [lifeStage, setLifeStage] = React.useState(
    initialPersona?.occupationOrLifeStage ?? ""
  );
  const [painPointsText, setPainPointsText] = React.useState(
    initialPersona?.corePainPoints.join(", ") ?? ""
  );
  const [desiresText, setDesiresText] = React.useState(
    initialPersona?.coreDesires.join(", ") ?? ""
  );
  const [habits, setHabits] = React.useState(
    initialPersona?.contentConsumptionHabits ?? ""
  );
  const [objectionsText, setObjectionsText] = React.useState(
    initialPersona?.commonObjections.join(", ") ?? ""
  );

  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (initialDna) {
      setCreatorName(initialDna.creatorName);
      setPrimaryNiche(initialDna.primaryNiche);
      setSecondaryNichesText(initialDna.secondaryNiches.join(", "));
      setUvp(initialDna.uniqueValueProposition);
      setAudienceSummary(initialDna.targetAudienceSummary);
      setArchetype(initialDna.personalityArchetype);
      setToneText(initialDna.toneOfVoice.join(", "));
      setStrengthsText(initialDna.strengths.join(", "));
      setTabooText(initialDna.tabooTopics.join(", "));
      setPlatforms(initialDna.primaryPlatforms);
      setFormatsText(initialDna.preferredFormats.join(", "));
    }
    if (initialPersona) {
      setPersonaName(initialPersona.personaName);
      setAgeRange(initialPersona.ageRange);
      setLifeStage(initialPersona.occupationOrLifeStage);
      setPainPointsText(initialPersona.corePainPoints.join(", "));
      setDesiresText(initialPersona.coreDesires.join(", "));
      setHabits(initialPersona.contentConsumptionHabits);
      setObjectionsText(initialPersona.commonObjections.join(", "));
    }
  }, [initialDna, initialPersona]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const dnaPayload: CreatorDnaEditable = {
        creatorName,
        primaryNiche,
        secondaryNiches: splitCsv(secondaryNichesText),
        uniqueValueProposition: uvp,
        targetAudienceSummary: audienceSummary,
        toneOfVoice: splitCsv(toneText),
        personalityArchetype: archetype,
        strengths: splitCsv(strengthsText),
        tabooTopics: splitCsv(tabooText),
        primaryPlatforms: platforms,
        preferredFormats: splitCsv(formatsText),
      };

      const hasPersonaFields =
        personaName.trim().length >= 2 &&
        lifeStage.trim().length >= 3 &&
        splitCsv(painPointsText).length >= 2 &&
        splitCsv(desiresText).length >= 2 &&
        habits.trim().length >= 5;

      const personaPayload: AudiencePersona | null = hasPersonaFields
        ? {
            personaName,
            ageRange,
            occupationOrLifeStage: lifeStage,
            corePainPoints: splitCsv(painPointsText),
            coreDesires: splitCsv(desiresText),
            contentConsumptionHabits: habits,
            commonObjections:
              splitCsv(objectionsText).length > 0
                ? splitCsv(objectionsText)
                : ["Takut terlalu rumit dipraktikkan"],
            activePlatforms: platforms,
          }
        : null;

      const res = await updateCreatorDnaAction(
        workspaceId,
        dnaPayload,
        personaPayload
      );
      if (res.success) {
        toast.success("Creator DNA & Audience Persona berhasil disimpan!");
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Creator DNA (Dapat Disunting Langsung)
              </CardTitle>
            </div>
            <Badge variant={initialDna ? "success" : "secondary"} className="text-[10px]">
              {initialDna ? "Aktif di Konteks AI Lintas Modul" : "Belum Tersimpan"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Identitas strategis ini diinjeksikan secara otomatis ke Niche Discovery, Ide Konten, dan Penulisan Skrip.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="font-semibold block mb-1">Nama Kreator / Brand</label>
              <Input
                value={creatorName}
                disabled={!canEdit}
                onChange={(e) => setCreatorName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Niche Utama</label>
              <Input
                value={primaryNiche}
                disabled={!canEdit}
                onChange={(e) => setPrimaryNiche(e.target.value)}
                placeholder="Contoh: Keuangan Praktis Pekerja Muda"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Arketipe Kepribadian</label>
              <Input
                value={archetype}
                disabled={!canEdit}
                onChange={(e) => setArchetype(e.target.value)}
                placeholder="Contoh: The Practical Mentor"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">
              Unique Value Proposition (UVP)
            </label>
            <textarea
              value={uvp}
              disabled={!canEdit}
              onChange={(e) => setUvp(e.target.value)}
              rows={2}
              required
              placeholder="Apa janji nilai realistis yang membedakan konten Anda dari kreator lain?"
              className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="font-semibold block mb-1">
                Sub-Niche Pendukung (pisahkan koma)
              </label>
              <Input
                value={secondaryNichesText}
                disabled={!canEdit}
                onChange={(e) => setSecondaryNichesText(e.target.value)}
                placeholder="Contoh: Budgeting Gaji, Produktivitas Kerja"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">
                Tone of Voice (pisahkan koma)
              </label>
              <Input
                value={toneText}
                disabled={!canEdit}
                onChange={(e) => setToneText(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="font-semibold block mb-1">
                Keunggulan Kreator (pisahkan koma)
              </label>
              <Input
                value={strengthsText}
                disabled={!canEdit}
                onChange={(e) => setStrengthsText(e.target.value)}
                placeholder="Contoh: Penjelasan runtut, riset teliti"
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">
                Topik Tabu / Dihindari (pisahkan koma)
              </label>
              <Input
                value={tabooText}
                disabled={!canEdit}
                onChange={(e) => setTabooText(e.target.value)}
                placeholder="Contoh: Flexing kekayaan, gosip politik"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="font-semibold block mb-1">
                Ringkasan Target Audiens
              </label>
              <textarea
                value={audienceSummary}
                disabled={!canEdit}
                onChange={(e) => setAudienceSummary(e.target.value)}
                rows={2}
                required
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">
                Format Konten Andalan (pisahkan koma)
              </label>
              <Input
                value={formatsText}
                disabled={!canEdit}
                onChange={(e) => setFormatsText(e.target.value)}
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ALL_PLATFORMS.map((p) => {
                  const active = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        setPlatforms((prev) =>
                          prev.includes(p)
                            ? prev.length > 1
                              ? prev.filter((x) => x !== p)
                              : prev
                            : [...prev, p]
                        )
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] uppercase ${
                        active
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audience Persona Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">Audience Persona</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Representasi tajam penonton ideal yang ingin Anda bantu melalui konten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="font-semibold block mb-1">Nama Persona</label>
              <Input
                value={personaName}
                disabled={!canEdit}
                onChange={(e) => setPersonaName(e.target.value)}
                placeholder="Contoh: Raka — First Jobber"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Rentang Usia</label>
              <Input
                value={ageRange}
                disabled={!canEdit}
                onChange={(e) => setAgeRange(e.target.value)}
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Pekerjaan / Fase Hidup</label>
              <Input
                value={lifeStage}
                disabled={!canEdit}
                onChange={(e) => setLifeStage(e.target.value)}
                placeholder="Contoh: Karyawan swasta 1-3 tahun pengalaman"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="font-semibold block mb-1">
                Pain Points Utama (minimal 2, pisahkan koma)
              </label>
              <Input
                value={painPointsText}
                disabled={!canEdit}
                onChange={(e) => setPainPointsText(e.target.value)}
                placeholder="Contoh: Gaji cepat habis, bingung mulai belajar skill baru"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">
                Keinginan / Aspirasi (minimal 2, pisahkan koma)
              </label>
              <Input
                value={desiresText}
                disabled={!canEdit}
                onChange={(e) => setDesiresText(e.target.value)}
                placeholder="Contoh: Punya dana darurat, karier naik kelas"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="font-semibold block mb-1">Kebiasaan Konsumsi Konten</label>
              <Input
                value={habits}
                disabled={!canEdit}
                onChange={(e) => setHabits(e.target.value)}
                placeholder="Contoh: Scroll TikTok/Reels saat istirahat makan siang & malam"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">
                Keraguan Umum / Objections (pisahkan koma)
              </label>
              <Input
                value={objectionsText}
                disabled={!canEdit}
                onChange={(e) => setObjectionsText(e.target.value)}
                placeholder="Contoh: Merasa tidak punya waktu, takut teori muluk"
              />
            </div>
          </div>
        </CardContent>
        {canEdit && (
          <CardFooter className="border-t border-border pt-4 flex justify-end">
            <Button type="submit" size="sm" isLoading={isSaving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" />
              <span>Simpan Perubahan DNA & Persona</span>
            </Button>
          </CardFooter>
        )}
      </Card>
    </form>
  );
}
