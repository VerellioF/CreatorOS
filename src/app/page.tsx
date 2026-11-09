import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils/utils";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Compass,
  FileText,
  Calendar,
  Bot,
  Lightbulb,
  Target,
  ShieldCheck,
  Zap,
  Star,
  Check,
  Flame,
  MessageSquare,
  HelpCircle,
  Play,
  Layers,
  Clock,
  Send,
} from "lucide-react";

export const metadata = {
  title: "CreatorOS AI — AI Content Creation Operating System untuk Kreator Indonesia",
  description:
    "Ubah ide mentah menjadi naskah video pendek viral & terjadwal dalam 60 detik. Didukung Creator DNA, Bank Ide, Script Studio (AIDA & PAS), dan Kalender Konten.",
};

export default async function HomePage() {
  const user = await AuthService.getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary scroll-smooth">
      {/* Ambient Radial Glow Effect */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[400px] bg-primary/10 dark:bg-primary/15 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none absolute top-[900px] right-0 w-[500px] h-[350px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[120px] -z-10" />

      {/* ========================================================================= */}
      {/* 1. NAVBAR                                                                 */}
      {/* ========================================================================= */}
      <header className="border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-foreground">
                CreatorOS <span className="text-primary font-extrabold">AI</span>
              </span>
              <Badge variant="comingSoon" className="text-[10px] px-1.5 py-0 font-mono hidden sm:inline-flex">
                Public Beta
              </Badge>
            </div>
          </Link>

          {/* Quick Nav Anchor Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Fitur Esensial
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              Cara Kerja
            </a>
            <a href="#sample-script" className="hover:text-foreground transition-colors">
              Contoh Naskah
            </a>
            <a href="#faq" className="hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>

          {/* Header Action CTAs */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/demo"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 font-medium hidden sm:inline-flex")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Akses Demo</span>
            </Link>
            <Link
              href="/sign-in"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs hidden sm:inline-flex")}
            >
              Masuk
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "sm" }), "text-xs gap-1.5 shadow-xs font-semibold")}
            >
              <span>Klaim 20 Kredit</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION                                                           */}
      {/* ========================================================================= */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 flex flex-col items-center text-center">
          {/* Public Beta Announcement Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold mb-6 shadow-xs animate-in fade-in-50">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Fase Public Beta Terbuka • Dapatkan 20 Kredit Gratis Langsung</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl leading-[1.12] mb-6">
            Ubah Ide Mentah Menjadi Naskah Video Viral & Terjadwal dalam{" "}
            <span className="bg-gradient-to-r from-primary via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              60 Detik
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-8">
            Bukan AI teks klise. CreatorOS AI mempelajari <strong>Creator DNA & gaya bicara unikmu</strong>,
            menghasilkan ide konten terarah, dan menulis naskah berformula psikologi (AIDA & PAS) yang siap kamu baca
            langsung di depan kamera HP.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md mb-6">
            <Link
              href="/demo"
              className={cn(buttonVariants({ size: "lg" }), "w-full gap-2 text-sm shadow-md font-semibold h-11")}
            >
              <Sparkles className="h-4 w-4" />
              <span>Akses Demo (1-Click Langsung)</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full text-sm h-11 font-medium")}
            >
              <span>Daftar Gratis</span>
            </Link>
          </div>

          {/* Micro Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Khusus TikTok, IG Reels & Shorts</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Tanpa Kartu Kredit</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Bahasa Indonesia Alami</span>
            </span>
          </div>

          {/* ========================================================================= */}
          {/* 3. INTERACTIVE PRODUCT SHOWCASE WINDOW (MOCKUP PREVIEW)                   */}
          {/* ========================================================================= */}
          <div className="w-full mt-14 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md shadow-2xl overflow-hidden text-left">
            {/* Window Title Bar */}
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="text-xs font-mono text-muted-foreground ml-2">
                  creatoros-ai // script-studio.tsx
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono border-border">
                  Model: Gemini 3.5 Flash
                </Badge>
                <Badge variant="success" className="text-[10px] font-mono">
                  Siap Rekam
                </Badge>
              </div>
            </div>

            {/* Window Content Layout */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border/60">
              {/* Left Context: Creator DNA Profile */}
              <div className="md:col-span-4 p-5 bg-card/40 space-y-4 text-xs">
                <div>
                  <div className="flex items-center gap-2 text-primary font-semibold mb-1">
                    <Compass className="h-4 w-4" />
                    <span>Creator DNA Terpasang</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    AI otomatis mengingat persona tanpa perlu kamu ketik ulang di setiap prompt.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-border/50 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-mono">Niche Utama</span>
                    <span className="font-semibold text-foreground">Bisnis Online & Produktivitas Pemula</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-mono">Tone of Voice</span>
                    <span className="font-semibold text-foreground">Santai, Lugas, Praktis, Anti-Teori</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-mono">Target Audiens</span>
                    <span className="font-semibold text-foreground">Karyawan & Mahasiswa yang mau mulai side income</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-2.5 text-[11px] text-primary">
                    <strong>💡 AI Insight:</strong> Naskah disesuaikan untuk ritme video vertikal 45-60 detik dengan retensi tinggi di 3 detik awal.
                  </div>
                </div>
              </div>

              {/* Right Output: The Real Generated Script */}
              <div className="md:col-span-8 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-bold text-sm text-foreground">
                        Hasil Naskah: 3 Kesalahan Fatal Mulai Ngonten
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Formula: PAS (Problem • Agitation • Solution) • Durasi Est. 50 detik
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    Format: 9:16 Short Video
                  </Badge>
                </div>

                {/* Hook Box */}
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                      🪝 HOOK (3 DETIK PERTAMA — BACA DENGAN INTONASI PENASARAN)
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">Detik 0:00 - 0:03</span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-foreground italic">
                    &ldquo;Jangan mulai bikin konten di 2026 kalau kamu masih lakuin 3 kesalahan fatal ini. Nomor dua
                    sering banget bikin channel mati sebelum 1000 followers!&rdquo;
                  </p>
                </div>

                {/* Body Content */}
                <div className="rounded-lg bg-muted/30 border border-border/60 p-3 space-y-2 text-xs leading-relaxed">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground font-mono">
                      📝 ISI CERITA & VALUE (FORMULA PAS)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">Detik 0:03 - 0:40</span>
                  </div>
                  <p className="text-foreground">
                    <strong>Pertama,</strong> kamu nunggu beli mic dan kamera mahal. Padahal penonton kabur bukan karena
                    videomu buram, tapi karena pembukaanmu membosankan.
                  </p>
                  <p className="text-foreground">
                    <strong>Kedua,</strong> topiknya gado-gado. Hari ini bahas crypto, besok review makanan, lusa curhat.
                    Algoritma bingung nentuin siapa yang harus nonton videomu.
                  </p>
                  <p className="text-foreground">
                    <strong>Ketiga,</strong> nggak punya 3 pilar konten tetap. Kuncinya cuma satu: tentukan 1 masalah
                    utama yang mau kamu selesaikan buat satu tipe orang spesifik.
                  </p>
                </div>

                {/* CTA & Caption */}
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
                      🎯 CALL TO ACTION (CTA) & CAPTION
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Detik 0:40 - 0:50</span>
                  </div>
                  <p className="font-medium text-foreground">
                    &ldquo;Komen &apos;MAU&apos; di bawah kalau kamu pengen kubuatkan panduan 3 pilar konten sesuai
                    niche-mu! Jangan lupa save video ini biar nggak lupa pas mau rekam.&rdquo;
                  </p>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    <strong>Rekomendasi Hashtag:</strong> #CreatorPemula #TipsNgonten #StrategiKonten #TikTokTips
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. PERBANDINGAN: SEBELUM vs SESUDAH MENGGUNAKAN CREATOROS                 */}
        {/* ========================================================================= */}
        <section className="py-20 border-t border-border/80 bg-muted/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
              <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider text-primary border-primary/30">
                Transformasi Kreator
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                Mengapa 90% Kreator Menyerah & Bagaimana CreatorOS Membantu
              </h2>
              <p className="text-sm text-muted-foreground">
                Membuat konten tidak seharusnya membuat stres. Lihat perbedaannya ketika kamu memiliki sistem:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card Kiri: Sebelum */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
                <div className="flex items-center gap-2 text-red-500 font-bold text-base">
                  <XCircle className="h-5 w-5" />
                  <span>Tanpa CreatorOS (Cara Lama)</span>
                </div>
                <ul className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>Buntu ide setiap hari:</strong> Duduk bengong di depan kamera 1 jam tanpa hasil rekaman.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>Akun gado-gado:</strong> Gonta-ganti topik sembarangan, algoritma bingung, views stuck di 200.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>Naskah bertele-tele:</strong> Pembukaan klise (&ldquo;Halo guys ketemu lagi...&rdquo;) yang langsung di-skip penonton di detik ke-2.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-red-500 font-bold">✕</span>
                    <span><strong>Posting tidak konsisten:</strong> Semangat upload 2 hari, lalu kehabisan tenaga dan menghilang 2 minggu.</span>
                  </li>
                </ul>
              </div>

              {/* Card Kanan: Sesudah */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-base">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Bersama CreatorOS AI (Sistematis)</span>
                </div>
                <ul className="space-y-3 text-xs sm:text-sm text-foreground leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Bank Ide Tanpa Batas:</strong> 1 klik langsung dapat 5-10 sudut pandang segar yang sudah sesuai pilar brandmu.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Kompas Niche Jelas:</strong> Creator DNA mengunci identitas, kepribadian, dan 3 pilar konten permanenmu.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Naskah Berformula Psikologi:</strong> Hook 3 detik mematikan + struktur AIDA/PAS siap baca di prompter HP.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Ritme Posting Terjaga:</strong> Kalender visual membuatmu selalu punya tabungan konten mingguan tanpa pusing.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. FITUR ESENSIAL SUITE SHOWCASE (#features)                              */}
        {/* ========================================================================= */}
        <section id="features" className="py-20 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider text-primary border-primary/30">
              Alat Utama Kreator
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              6 Fitur Esensial yang Aktif di Public Beta
            </h2>
            <p className="text-sm text-muted-foreground">
              Semua modul inti ini telah aktif 100% dan dapat langsung kamu gunakan secara gratis dengan 20 kredit awal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-xl border border-border/80 bg-card p-6 space-y-3 hover:border-primary/50 transition-colors shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-foreground tracking-tight">Creator Profile & DNA</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Wawancara adaptif AI untuk mengunci keahlian, tone of voice, dan arketipe unikmu agar konten tidak pernah terdengar seperti bot.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-xl border border-border/80 bg-card p-6 space-y-3 hover:border-primary/50 transition-colors shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-foreground tracking-tight">Niche Discovery & Pillars</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Temukan ceruk pasar potensial dengan persaingan sehat dan bangun 3 pilar konten utama yang konsisten di mata algoritma.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-xl border border-border/80 bg-card p-6 space-y-3 hover:border-primary/50 transition-colors shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Lightbulb className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-foreground tracking-tight">Idea Generator & Backlog</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Dapatkan puluhan ide konten terarah sekali klik dan simpan di backlog ide terstruktur agar kamu tidak pernah kehabisan materi.
              </p>
            </div>

            {/* Card 4 */}
            <div className="rounded-xl border border-primary/30 bg-card p-6 space-y-3 hover:border-primary transition-colors shadow-sm relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <Badge variant="default" className="text-[9px] px-1.5 py-0 font-mono">
                  Hero Feature
                </Badge>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-foreground tracking-tight">Script Studio (Hooks & Naskah)</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Otomatisasi hook viral 3 detik pertama, struktur cerita berformula AIDA/PAS, dan CTA penutup siap baca di depan kamera.
              </p>
            </div>

            {/* Card 5 */}
            <div className="rounded-xl border border-border/80 bg-card p-6 space-y-3 hover:border-primary/50 transition-colors shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-foreground tracking-tight">Creator AI Assistant</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Teman diskusi dan sparring partner kreatif 24/7 untuk evaluasi hook, bedah algoritma, atau konsultasi strategi kapan saja.
              </p>
            </div>

            {/* Card 6 */}
            <div className="rounded-xl border border-border/80 bg-card p-6 space-y-3 hover:border-primary/50 transition-colors shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-foreground tracking-tight">Content Calendar</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Petakan jadwal rekaman dan hari posting dalam kalender visual bulanan untuk menjaga momentum pertumbuhan akunmu.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. CARA KERJA (HOW IT WORKS) (#how-it-works)                              */}
        {/* ========================================================================= */}
        <section id="how-it-works" className="py-20 border-t border-border/80 bg-muted/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider text-primary border-primary/30">
                Alur Praktis
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                Dari Ide ke Siap Rekam Hanya dalam 4 Langkah
              </h2>
              <p className="text-sm text-muted-foreground">
                Tidak butuh waktu berjam-jam untuk memikirkan konten setiap hari.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 relative">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono font-bold text-xs">
                  1
                </span>
                <h4 className="font-bold text-sm text-foreground">Wawancara DNA</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Jawab pertanyaan adaptif singkat agar AI memahami gaya bahasa dan target penontonmu secara mendalam.
                </p>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 relative">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-white font-mono font-bold text-xs">
                  2
                </span>
                <h4 className="font-bold text-sm text-foreground">Pilih Ide Segar</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Buka Idea Generator dan pilih 1 dari 10 sudut pandang ide yang telah dikurasi sesuai pilar kontenmu.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 relative">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white font-mono font-bold text-xs">
                  3
                </span>
                <h4 className="font-bold text-sm text-foreground">Tulis di Script Studio</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  AI menulis naskah lengkap: 3 opsi hook pemikat, naskah kalimat demi kalimat, dan CTA pemicu komentar.
                </p>
              </div>

              {/* Step 4 */}
              <div className="rounded-xl border border-border/80 bg-card p-5 space-y-3 relative">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white font-mono font-bold text-xs">
                  4
                </span>
                <h4 className="font-bold text-sm text-foreground">Rekam & Jadwalkan</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nyalakan kamera HP-mu, baca naskahnya, dan masukkan jadwal tayang ke dalam Content Calendar!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. SHOWCASE CONTOH NASKAH (#sample-script)                                */}
        {/* ========================================================================= */}
        <section id="sample-script" className="py-20 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider text-primary border-primary/30">
              Kualitas Output
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              Contoh Naskah Asli yang Dihasilkan CreatorOS
            </h2>
            <p className="text-sm text-muted-foreground">
              Bandingkan kualitas naskah kami dengan AI biasa. Mengalir natural dalam Bahasa Indonesia sehari-hari:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card Niche 1 */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <Badge variant="outline" className="text-[10px] font-mono">
                  Niche: Edukasi Karir
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">Est. 45s</span>
              </div>
              <div className="text-xs space-y-2">
                <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-foreground font-semibold">
                  &ldquo;Gaji 5 juta tapi bingung kenapa tabungan nol terus? Jangan-jangan kamu kejebak fenomena lifestyle creep...&rdquo;
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Formula AIDA yang memaparkan 2 pos pengeluaran bocor halus dan diakhiri CTA: &ldquo;Save video ini buat panduan evaluasi gajian besok.&rdquo;
                </p>
              </div>
            </div>

            {/* Card Niche 2 */}
            <div className="rounded-xl border border-primary/40 bg-card p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <Badge variant="default" className="text-[10px] font-mono">
                  Niche: Bisnis / Affiliate
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">Est. 55s</span>
              </div>
              <div className="text-xs space-y-2">
                <div className="p-2.5 rounded-md bg-primary/10 border border-primary/20 text-foreground font-semibold">
                  &ldquo;Ini alasan kenapa barang affiliate kamu nggak pernah laku padahal videomu tembus 100 ribu views...&rdquo;
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Formula PAS yang membahas kesalahan meletakkan link tanpa menjelaskan solusi masalah pembeli secara emosional.
                </p>
              </div>
            </div>

            {/* Card Niche 3 */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <Badge variant="outline" className="text-[10px] font-mono">
                  Niche: Self Improvement
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">Est. 40s</span>
              </div>
              <div className="text-xs space-y-2">
                <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-foreground font-semibold">
                  &ldquo;Bukan malas, kamu cuma overwhelmed. Coba terapin aturan 2 menit ini tiap kali mau nunda sesuatu...&rdquo;
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Naskah storytelling singkat berbasis sains perilaku yang memancing share dan save tinggi di TikTok/Reels.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 8. FAQ SECTION (#faq)                                                     */}
        {/* ========================================================================= */}
        <section id="faq" className="py-20 border-t border-border/80 bg-muted/20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
              <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider text-primary border-primary/30">
                Tanya Jawab
              </Badge>
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                Pertanyaan yang Sering Diajukan
              </h2>
              <p className="text-sm text-muted-foreground">
                Semua hal yang perlu kamu ketahui tentang masa Public Beta CreatorOS AI:
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-left">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>Apakah CreatorOS benar-benar gratis untuk dicoba?</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  Ya, 100% gratis! Di fase Public Beta ini, setiap pengguna baru otomatis mendapatkan <strong>20 Kredit Gratis</strong> tanpa perlu memasukkan kartu kredit atau data pembayaran apapun.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-left">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>Apa bedanya CreatorOS dengan ChatGPT biasa?</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  ChatGPT membutuhkan prompt panjang berulang kali dan bahasanya sering terdengar klise/kaku. CreatorOS memiliki sistem <strong>Creator DNA</strong> yang otomatis mengingat profil niche, tone of voice, dan arketipe kontenmu. Sekali klik, naskah yang keluar langsung berstruktur video pendek (Hook 3 detik + AIDA/PAS + CTA) siap rekam.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-left">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>Berapa banyak konten yang bisa saya buat dengan 20 kredit?</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  20 kredit pas untuk menyelesaikan 1 alur penuh perjalanan kreator: wawancara Creator DNA, riset niche, pembentukan pilar strategi, generate 1 batch ide (5 ide), menulis <strong>2 Naskah Lengkap Siap Rekam</strong>, dan 3 sesi tanya jawab dengan AI Assistant.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-left">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>Apakah naskah ini cocok untuk TikTok, Reels, dan Shorts?</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  Sangat cocok. Format naskah dan durasi kata telah dioptimalkan khusus untuk video vertikal 9:16 dengan durasi 30 hingga 90 detik, lengkap dengan rekomendasi caption dan hashtag relevan.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-left">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>Kapan fitur studio video dan publishing otomatis dibuka?</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                  Fitur studio media lanjutan dan auto-publishing saat ini ditandai sebagai &ldquo;Soon&rdquo; karena sedang kami optimalkan. Fitur-fitur tersebut akan dibuka secara bertahap setelah fase validasi pasar Public Beta selesai.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 9. FINAL CALL TO ACTION BANNER                                            */}
        {/* ========================================================================= */}
        <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 via-card to-card p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-primary/20 rounded-full blur-[80px]" />

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Mulai Bangun Channel Impianmu Hari Ini</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground max-w-2xl mx-auto leading-tight">
              Siap Menghasilkan Naskah Viral Pertamamu?
            </h2>

            <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Bergabunglah bersama kreator lain yang sudah meninggalkan cara lama yang melelahkan. Dapatkan 20 kredit gratis langsung saat mendaftar.
            </p>

            <div className="pt-2">
              <Link
                href="/sign-up"
                className={cn(buttonVariants({ size: "lg" }), "gap-2 shadow-lg font-bold text-sm h-12 px-8")}
              >
                <span>Daftar & Klaim 20 Kredit Gratis</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Proses pendaftaran hanya 30 detik • Tidak butuh kartu kredit • Akses instan
            </p>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 10. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="border-t border-border bg-card/40 py-12 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm text-foreground">CreatorOS AI</span>
            <span className="text-muted-foreground/60">•</span>
            <span>Platform Operasi Konten Kreator Indonesia</span>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Kebijakan Privasi
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Ketentuan Layanan
            </Link>
            <Link href="/support" className="hover:text-primary transition-colors">
              Pusat Bantuan
            </Link>
          </div>

          <div>
            <p>&copy; {new Date().getFullYear()} CreatorOS AI. Hak cipta dilindungi.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
