"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Compass,
  Target,
  FileText,
  Send,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Lightbulb,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BeginnerGuideCardProps {
  hasDna: boolean;
  hasNiche: boolean;
  hasPillars: boolean;
  hasScripts: boolean;
}

export function BeginnerGuideCard({
  hasDna,
  hasNiche,
  hasPillars,
  hasScripts,
}: BeginnerGuideCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [activeTip, setActiveTip] = React.useState<number | null>(0);

  const steps = [
    {
      step: 1,
      title: "Bangun Creator DNA Anda",
      desc: "Isi wawancara adaptif AI 5 menit agar seluruh ide & naskah selaras dengan gaya bicara unik Anda.",
      href: "/creator-profile",
      actionText: hasDna ? "Review DNA" : "Mulai Onboarding",
      completed: hasDna,
      badge: "3 Menit",
      icon: Sparkles,
      tip: "Formula Karakter: Jangan berusaha menjadi seperti creator lain. Algoritma menyukai otentisitas dan keunikan sudut pandang.",
    },
    {
      step: 2,
      title: "Pilih & Validasi Niche",
      desc: "Eksplorasi ceruk konten dengan potensi pertumbuhan tinggi, persaingan realistis, dan potensi monetisasi.",
      href: "/niche-discovery",
      actionText: hasNiche ? "Kelola Niche" : "Eksplorasi Niche",
      completed: hasNiche,
      badge: "5 Menit",
      icon: Compass,
      tip: "Kiat Niche: Niche spesifik (misal: 'Keuangan untuk Freelancer Muda') jauh lebih mudah viral daripada topik general ('Keuangan').",
    },
    {
      step: 3,
      title: "Rancang 3-5 Pilar Konten",
      desc: "Tetapkan tema utama (misal: Edukasi, Cerita Dibalik Layar, Tips Cepat) agar tidak pernah bingung mau posting apa.",
      href: "/strategy",
      actionText: hasPillars ? "Lihat Pilar" : "Buat Pilar",
      completed: hasPillars,
      badge: "5 Menit",
      icon: Target,
      tip: "Kiat Pilar: Terapkan aturan 70-20-10: 70% konten edukasi bernilai tinggi, 20% engagement/opini, 10% promosi/jualan.",
    },
    {
      step: 4,
      title: "Buat Paket Naskah Pertama",
      desc: "Hasilkan naskah siap rekam lengkap dengan Hook 3 detik pertama, isi padat, dan Call-to-Action (CTA) interaktif.",
      href: "/studio/scripts",
      actionText: hasScripts ? "Buka Naskah" : "Tulis Naskah",
      completed: hasScripts,
      badge: "2 Menit",
      icon: FileText,
      tip: "Kiat Hook: Hindari opening klise seperti 'Halo guys nama gue...'. Mulai dengan pertanyaan kontras atau fakta mengejutkan!",
    },
    {
      step: 5,
      title: "Publikasi & Pantau Pertumbuhan",
      desc: "Jadwalkan atau gunakan Checklist Ekspor Manual untuk posting di TikTok, Reels, atau YouTube Shorts, lalu pantau metriknya.",
      href: "/publish",
      actionText: "Ke Publishing",
      completed: false,
      badge: "Berkelanjutan",
      icon: Send,
      tip: "Kiat Konsistensi: Kuantitas di awal membangun kualitas. Targetkan 3 konten terarah per minggu untuk membangun momentum.",
    },
  ];

  const completedStepsCount = [hasDna, hasNiche, hasPillars, hasScripts].filter(Boolean).length;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lightbulb className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span>Panduan Kilat Kreator Pemula</span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  {completedStepsCount}/5 Langkah Siap
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Alur sistematis untuk mengubah ide mentah menjadi konten konsisten tanpa rasa bingung.
              </CardDescription>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start sm:self-auto py-1 px-2 rounded hover:bg-muted/50"
          >
            <span>{isExpanded ? "Sembunyikan" : "Tampilkan Panduan"}</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-1 animate-in fade-in-50 duration-200">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                    item.completed
                      ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20"
                      : "border-border bg-card/70 hover:border-primary/40 hover:bg-card"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {item.step}
                        </span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-medium">
                          {item.badge}
                        </Badge>
                      </div>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-foreground line-clamp-1">{item.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-2 border-t border-border/40 flex items-center justify-between">
                    <button
                      onClick={() => setActiveTip(activeTip === idx ? null : idx)}
                      className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                      title="Lihat tips praktis"
                    >
                      <HelpCircle className="h-3 w-3" />
                      <span>Tips</span>
                    </button>

                    <Link href={item.href}>
                      <Button
                        size="sm"
                        variant={item.completed ? "outline" : "default"}
                        className="h-7 text-[11px] px-2.5 gap-1"
                      >
                        <span>{item.actionText}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Tip Box */}
          {activeTip !== null && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5 text-xs text-foreground/90 animate-in fade-in-50">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-primary text-[11px] uppercase tracking-wider">
                  Tips Praktis Langkah {activeTip + 1}:
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">{steps[activeTip].tip}</p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
