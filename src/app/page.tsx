import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Layers,
  Compass,
} from "lucide-react";

export default async function HomePage() {
  const user = await AuthService.getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20 selection:text-primary">
      {/* Navbar */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-foreground">
              CreatorOS <span className="text-primary font-extrabold">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-xs">
                Masuk
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="text-xs gap-1.5 shadow-sm">
                <span>Mulai Gratis</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold mb-6 animate-in fade-in-50">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI Content Creation Operating System • Private MVP</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-3xl leading-[1.15] mb-6">
          Ubah Ide Mentah Menjadi Konten Konsisten dengan{" "}
          <span className="bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Kecerdasan Sistematis
          </span>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-8">
          Platform all-in-one untuk konten kreator, affiliate marketer, dan bisnis di Indonesia.
          Dari penemuan niche, strategi pilar, penulisan script, hingga jadwal tayang multi-platform.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mb-14">
          <Link href="/sign-up" className="w-full">
            <Button size="lg" className="w-full gap-2 shadow-lg">
              <span>Mulai Buat Konten</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/sign-in" className="w-full">
            <Button variant="outline" size="lg" className="w-full">
              Masuk Akun
            </Button>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left pt-8 border-t border-border">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
              <Compass className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm mb-1 text-foreground">Niche & Creator DNA</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ekstraksi persona unik, tone of voice, dan niche market fit tanpa template generik.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm mb-1 text-foreground">Multi-Tenant Workspaces</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Organisir brand, channel affiliate, dan klien berbeda dalam ruang kerja terisolasi.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm mb-1 text-foreground">Enterprise Security</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Didukung Supabase PostgreSQL dengan proteksi Row Level Security (RLS) ketat.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} CreatorOS AI. Built with precision for Indonesian creators.</p>
      </footer>
    </div>
  );
}
