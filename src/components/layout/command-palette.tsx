"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  User,
  Compass,
  TrendingUp,
  Users2,
  Target,
  Lightbulb,
  FileText,
  Clapperboard,
  Image as ImageIcon,
  Mic,
  Captions,
  Video,
  Film,
  Download,
  Send,
  BarChart3,
  CreditCard,
  Receipt,
  Cpu,
  LifeBuoy,
  Settings,
  ShieldCheck,
  X,
  ArrowRight,
  Bot,
  Calendar,
  Coins,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/utils";

import { Badge } from "@/components/ui/badge";

interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: "Langkah Awal" | "Riset & Strategi" | "Studio Produksi" | "Publikasi & Analisis" | "Sistem & Akun";
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  isReady?: boolean;
}

const COMMAND_ITEMS: CommandItem[] = [
  // Langkah Awal
  {
    id: "dashboard",
    title: "Dashboard Utama",
    description: "Ringkasan setup creator, progress mingguan, dan aksi cepat",
    category: "Langkah Awal",
    href: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["beranda", "home", "progress", "ringkasan", "overview"],
    isReady: true,
  },
  {
    id: "creator-profile",
    title: "Creator Profile & DNA",
    description: "Wawancara adaptif AI, arketipe persona, dan voice brand unik",
    category: "Langkah Awal",
    href: "/creator-profile",
    icon: User,
    keywords: ["dna", "arketipe", "persona", "wawancara", "profil", "onboarding", "suara", "voice"],
    isReady: true,
  },
  {
    id: "niche-discovery",
    title: "Niche Discovery Engine",
    description: "Eksplorasi ceruk pasar potensial, persaingan, dan monetisasi",
    category: "Langkah Awal",
    href: "/niche-discovery",
    icon: Compass,
    keywords: ["niche", "ceruk", "pasar", "rekomendasi", "topik", "kategori"],
    isReady: true,
  },
  {
    id: "ai-assistant",
    title: "Creator AI Assistant",
    description: "Konsultasi strategi, evaluasi hook, susun naskah, dan bedah algoritma",
    category: "Langkah Awal",
    href: "/ai-assistant",
    icon: Bot,
    keywords: ["ai", "assistant", "chat", "tanya", "konsultasi", "bantuan", "hook", "naskah"],
    isReady: true,
  },

  // Riset & Strategi
  {
    id: "trends",
    title: "Trend Research Radar",
    description: "Pantau tren viral, hashtag naik daun, dan bukti lapangan",
    category: "Riset & Strategi",
    href: "/trends",
    icon: TrendingUp,
    keywords: ["trend", "tren", "viral", "hashtag", "riset", "fyp"],
    isReady: false,
  },
  {
    id: "competitors",
    title: "Competitor Research",
    description: "Analisis kelemahan dan peluang konten dari kompetitor",
    category: "Riset & Strategi",
    href: "/competitors",
    icon: Users2,
    keywords: ["kompetitor", "pesaing", "analisis", "benchmark", "konten kompetitor"],
    isReady: false,
  },
  {
    id: "strategy",
    title: "Content Strategy & Pilar",
    description: "Rancang 3-5 pilar konten utama dan positioning brand",
    category: "Riset & Strategi",
    href: "/strategy",
    icon: Target,
    keywords: ["pilar", "strategi", "brand", "positioning", "jadwal", "rencana"],
    isReady: true,
  },
  {
    id: "ideas",
    title: "Idea Generator & Bank",
    description: "Brainstorming puluhan ide konten terarah sesuai pilar Anda",
    category: "Riset & Strategi",
    href: "/ideas",
    icon: Lightbulb,
    keywords: ["ide", "brainstorm", "topik", "bank ide", "inspirasi"],
    isReady: true,
  },

  // Studio Produksi
  {
    id: "scripts",
    title: "Script Studio",
    description: "Tulis naskah viral dengan struktur Hook, Value, dan CTA",
    category: "Studio Produksi",
    href: "/studio/scripts",
    icon: FileText,
    keywords: ["naskah", "script", "hook", "caption", "cta", "tulis"],
    isReady: true,
  },
  {
    id: "storyboard",
    title: "Storyboard Studio",
    description: "Perencanaan visual adegan demi adegan secara terstruktur",
    category: "Studio Produksi",
    href: "/studio/storyboard",
    icon: Clapperboard,
    keywords: ["storyboard", "visual", "shot", "adegan", "skrip visual"],
    isReady: false,
  },
  {
    id: "images",
    title: "Image Studio",
    description: "Hasilkan gambar promosi, visual adegan, dan thumbnail dengan AI",
    category: "Studio Produksi",
    href: "/studio/images",
    icon: ImageIcon,
    keywords: ["gambar", "image", "thumbnail", "cover", "visual", "foto"],
    isReady: false,
  },
  {
    id: "voice",
    title: "Voice Studio",
    description: "Generate voiceover natural dalam Bahasa Indonesia & multi-bahasa",
    category: "Studio Produksi",
    href: "/studio/voice",
    icon: Mic,
    keywords: ["suara", "voice", "voiceover", "audio", "dubbing", "elevenlabs"],
    isReady: false,
  },
  {
    id: "subtitles",
    title: "Subtitle Studio",
    description: "Buat subtitle otomatis akurat dan transkripsi cepat",
    category: "Studio Produksi",
    href: "/studio/subtitles",
    icon: Captions,
    keywords: ["subtitle", "teks", "transkrip", "captions", "srt", "vtt"],
    isReady: false,
  },
  {
    id: "video",
    title: "Video Studio",
    description: "Sintesis klip video dinamis dari naskah dan aset",
    category: "Studio Produksi",
    href: "/studio/video",
    icon: Video,
    keywords: ["video", "klip", "render", "sintesis", "animasi"],
    isReady: false,
  },
  {
    id: "timeline",
    title: "Timeline Editor",
    description: "Susun adegan video, musik, dan audio dalam timeline multi-track",
    category: "Studio Produksi",
    href: "/studio/timeline",
    icon: Film,
    keywords: ["timeline", "editor", "cut", "potong", "edit video"],
    isReady: false,
  },
  {
    id: "export",
    title: "Export Center",
    description: "Render video resolusi tinggi siap unggah ke media sosial",
    category: "Studio Produksi",
    href: "/studio/export",
    icon: Download,
    keywords: ["ekspor", "export", "download", "unduh", "render final"],
    isReady: false,
  },

  // Publikasi & Analisis
  {
    id: "publish",
    title: "Publishing Center",
    description: "Jadwalkan atau ekspor panduan manual publikasi multi-platform",
    category: "Publikasi & Analisis",
    href: "/publish",
    icon: Send,
    keywords: ["publish", "publikasi", "jadwal", "posting", "tiktok", "instagram", "youtube"],
    isReady: false,
  },
  {
    id: "calendar",
    title: "Content Calendar",
    description: "Perencanaan jadwal tayang konten dan distribusi multi-platform",
    category: "Publikasi & Analisis",
    href: "/calendar",
    icon: Calendar,
    keywords: ["kalender", "calendar", "jadwal", "schedule", "posting", "waktu"],
    isReady: true,
  },
  {
    id: "analytics",
    title: "Performance Analytics & AI Diagnostics",
    description: "Analisis views, konversi, dan diagnosa mendalam AI tanpa halusinasi",
    category: "Publikasi & Analisis",
    href: "/analytics",
    icon: BarChart3,
    keywords: ["analisis", "metrik", "views", "diagnosa", "ai analyst", "performa"],
    isReady: false,
  },
  {
    id: "monetization",
    title: "Monetization Hub",
    description: "Kalkulator rate card endorsement dan pipeline brand deal",
    category: "Publikasi & Analisis",
    href: "/monetization",
    icon: Coins,
    keywords: ["monetisasi", "rate card", "sponsorship", "endorse", "brand deal", "uang", "cuan"],
    isReady: false,
  },

  // Sistem & Akun
  {
    id: "billing",
    title: "Billing & Plans",
    description: "Kelola paket langganan CreatorOS AI via Midtrans",
    category: "Sistem & Akun",
    href: "/settings/billing",
    icon: CreditCard,
    keywords: ["billing", "paket", "harga", "langganan", "pembayaran", "midtrans", "upgrade"],
    isReady: false,
  },
  {
    id: "usage",
    title: "Usage & Token Ledger",
    description: "Pantau saldo kredit dan histori pemakaian token AI secara transparan",
    category: "Sistem & Akun",
    href: "/usage",
    icon: Receipt,
    keywords: ["kredit", "token", "biaya", "usage", "saldo", "pemakaian"],
    isReady: true,
  },
  {
    id: "agents",
    title: "Agent Workspace",
    description: "Otomatisasi alur kerja multi-agent mandiri dengan checkpoint persetujuan",
    category: "Sistem & Akun",
    href: "/agents",
    icon: Cpu,
    keywords: ["agent", "otomatisasi", "workflow", "orchestrator", "ai tim"],
    isReady: false,
  },
  {
    id: "support",
    title: "Support Center",
    description: "Pusat bantuan creator, tanya jawab (FAQ), dan tiket aduan",
    category: "Sistem & Akun",
    href: "/support",
    icon: LifeBuoy,
    keywords: ["bantuan", "support", "tiket", "faq", "hubungi", "kendala"],
    isReady: true,
  },
  {
    id: "settings",
    title: "Workspace Settings",
    description: "Pengaturan akun, nama workspace, dan preferensi bahasa",
    category: "Sistem & Akun",
    href: "/settings",
    icon: Settings,
    keywords: ["pengaturan", "settings", "profil", "workspace", "preferensi"],
    isReady: true,
  },
  {
    id: "admin",
    title: "Admin Console",
    description: "Manajemen sistem terpusat, telemetri AI global, dan pemantauan server",
    category: "Sistem & Akun",
    href: "/admin",
    icon: ShieldCheck,
    keywords: ["admin", "superadmin", "server", "telemetri", "manajemen"],
    isReady: true,
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSuperadmin?: boolean;
}

export function CommandPalette({
  open,
  onOpenChange,
  isSuperadmin = false,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  // Keyboard shortcut (⌘K or Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Reset query on close
  React.useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const baseItems = React.useMemo(() => {
    return COMMAND_ITEMS.filter((item) => {
      if (item.id === "admin" && !isSuperadmin) {
        return false;
      }
      return true;
    });
  }, [isSuperadmin]);

  const filteredItems = React.useMemo(() => {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return baseItems;

    return baseItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(cleanQuery) ||
        item.description.toLowerCase().includes(cleanQuery) ||
        item.category.toLowerCase().includes(cleanQuery) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(cleanQuery))
      );
    });
  }, [query, baseItems]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden shadow-2xl border-border bg-card">
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-muted/20">
          <Search className="h-4 w-4 text-primary shrink-0 opacity-80" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nama fitur, ide, naskah, studio, atau bantuan..."
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/70 focus:outline-none text-foreground"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Tidak ditemukan hasil untuk &ldquo;{query}&rdquo;</p>
              <p>Coba kata kunci lain seperti: <em>naskah, pilar, dna, video, analytics, bantuan</em>.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.isReady === false) return;
                    handleSelect(item.href);
                  }}
                  disabled={item.isReady === false}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    item.isReady === false
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-primary/10 hover:text-primary group focus:bg-primary/10 focus:outline-none"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground group-hover:bg-primary/20 group-hover:text-primary shrink-0 transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded shrink-0">
                          {item.category}
                        </span>
                        {item.isReady === false && (
                          <Badge variant="comingSoon" className="text-[9px] px-1 py-0 font-mono">
                            Soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate group-hover:text-primary/80 transition-colors">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {item.isReady !== false && (
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Info */}
        <div className="border-t border-border px-4 py-2.5 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Pintasan Cepat:</span>
            <span className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px] font-mono">⌘K</span>
            <span>atau</span>
            <span className="bg-background border border-border px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl+K</span>
          </div>
          <span>CreatorOS AI v0.7.2</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
