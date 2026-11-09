"use client";

import * as React from "react";
import {
  Coins,
  Calculator,
  Briefcase,
  TrendingUp,
  Plus,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils/utils";

interface BrandDeal {
  id: string;
  brandName: string;
  campaignTitle: string;
  platform: "tiktok" | "instagram" | "youtube" | "shopee";
  amountIdr: number;
  status: "prospecting" | "negotiating" | "in_production" | "pending_payment" | "completed";
  dueDate: string;
}

interface MonetizationHubViewProps {
  workspaceId: string;
  creatorName?: string;
  primaryNiche?: string;
}

const NICHE_MULTIPLIERS: Record<string, { multiplier: number; label: string }> = {
  finance: { multiplier: 1.8, label: "Keuangan & Investasi (CPM Tinggi)" },
  tech: { multiplier: 1.5, label: "Teknologi, Gadget & Software" },
  business: { multiplier: 1.6, label: "Bisnis, Karir & Edukasi" },
  beauty: { multiplier: 1.3, label: "Kecantikan & Skincare" },
  food: { multiplier: 1.1, label: "Kuliner & F&B" },
  lifestyle: { multiplier: 1.0, label: "Lifestyle, Vlog & Entertainment" },
};

const STATUS_CONFIGS: Record<
  BrandDeal["status"],
  { label: string; badgeVariant: "default" | "secondary" | "warning" | "success" | "outline" }
> = {
  prospecting: { label: "Penjajakan", badgeVariant: "outline" },
  negotiating: { label: "Negosiasi", badgeVariant: "warning" },
  in_production: { label: "Produksi", badgeVariant: "default" },
  pending_payment: { label: "Menunggu Bayar", badgeVariant: "warning" },
  completed: { label: "Selesai", badgeVariant: "success" },
};

export function MonetizationHubView({
  workspaceId,
  creatorName = "Kreator",
  primaryNiche = "General",
}: MonetizationHubViewProps) {
  const [activeTab, setActiveTab] = React.useState<"calculator" | "deals" | "affiliate" | "roadmap">("calculator");

  // Rate Card Calculator State
  const [followerCount, setFollowerCount] = React.useState<number>(25000);
  const [avgViews, setAvgViews] = React.useState<number>(8000);
  const [engagementRate, setEngagementRate] = React.useState<number>(4.5);
  const [selectedNicheKey, setSelectedNicheKey] = React.useState<string>("business");
  const [includeUsageRights, setIncludeUsageRights] = React.useState<boolean>(true);
  const [isCopied, setIsCopied] = React.useState(false);

  // Brand Deals Pipeline State
  const [deals, setDeals] = React.useState<BrandDeal[]>([
    {
      id: "deal-1",
      brandName: "FinTech Nusantara",
      campaignTitle: "Review Aplikasi Tabungan Otomatis",
      platform: "tiktok",
      amountIdr: 2500000,
      status: "in_production",
      dueDate: "2026-11-05",
    },
    {
      id: "deal-2",
      brandName: "Kopi Seduh Lokal",
      campaignTitle: "TikTok & Reels Barter + Komisi Affiliate",
      platform: "instagram",
      amountIdr: 1200000,
      status: "pending_payment",
      dueDate: "2026-11-10",
    },
    {
      id: "deal-3",
      brandName: "SaaS Productivity ID",
      campaignTitle: "Sponsorship Video Tutorial Dedicated",
      platform: "youtube",
      amountIdr: 4500000,
      status: "negotiating",
      dueDate: "2026-11-15",
    },
  ]);

  const [dealModalOpen, setDealModalOpen] = React.useState(false);
  const [newBrandName, setNewBrandName] = React.useState("");
  const [newCampaignTitle, setNewCampaignTitle] = React.useState("");
  const [newPlatform, setNewPlatform] = React.useState<BrandDeal["platform"]>("tiktok");
  const [newAmountIdr, setNewAmountIdr] = React.useState<number>(2000000);
  const [newStatus, setNewStatus] = React.useState<BrandDeal["status"]>("prospecting");
  const [newDueDate, setNewDueDate] = React.useState("");

  // Rate card formula estimation
  const nicheMultiplier = NICHE_MULTIPLIERS[selectedNicheKey]?.multiplier ?? 1.2;
  const baseRatePerView = 85; // IDR per estimated view
  const engBonus = 1 + (engagementRate - 3) * 0.08;
  const rawBase = avgViews * baseRatePerView * nicheMultiplier * Math.max(0.7, engBonus);

  const estimatedTikTokReelsRate = Math.round((rawBase * 0.9) / 50000) * 50000;
  const estimatedShortsRate = Math.round((rawBase * 0.75) / 50000) * 50000;
  const estimatedDedicatedYoutubeRate = Math.round((rawBase * 2.2) / 100000) * 100000;
  const usageRightsFee = includeUsageRights ? Math.round((estimatedTikTokReelsRate * 0.3) / 50000) * 50000 : 0;

  const totalPackageRate = estimatedTikTokReelsRate + usageRightsFee;

  const handleCopyRateCard = () => {
    const text = `📊 RATE CARD RESMI — ${creatorName.toUpperCase()}
Niche: ${NICHE_MULTIPLIERS[selectedNicheKey]?.label}
Followers: ${followerCount.toLocaleString("id-ID")} | Rata-rata Views: ${avgViews.toLocaleString("id-ID")}

1. TikTok / IG Reels (60s Dedicated): Rp ${estimatedTikTokReelsRate.toLocaleString("id-ID")}
2. YouTube Shorts: Rp ${estimatedShortsRate.toLocaleString("id-ID")}
3. YouTube Dedicated Video (3-5 min): Rp ${estimatedDedicatedYoutubeRate.toLocaleString("id-ID")}
${includeUsageRights ? `4. Lisensi Iklan / Usage Rights (30 Hari): Rp ${usageRightsFee.toLocaleString("id-ID")}\n` : ""}
Total Paket Rekomendasi: Rp ${totalPackageRate.toLocaleString("id-ID")}

Syarat & Ketentuan Singkat:
- Termasuk 1x revisi minor sebelum posting
- DP 50% sebelum produksi dimulai, pelunasan H-1 sebelum tayang
- Format naskah & hook disesuaikan dengan tone organik kreator`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success("Rate card berhasil disalin ke clipboard!");
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleAddBrandDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim() || !newCampaignTitle.trim() || !newDueDate) {
      toast.error("Lengkapi seluruh informasi brand deal");
      return;
    }

    const newDeal: BrandDeal = {
      id: `deal-${Date.now()}`,
      brandName: newBrandName.trim(),
      campaignTitle: newCampaignTitle.trim(),
      platform: newPlatform,
      amountIdr: Number(newAmountIdr),
      status: newStatus,
      dueDate: newDueDate,
    };

    setDeals((prev) => [newDeal, ...prev]);
    toast.success("Brand deal berhasil ditambahkan ke pipeline!");
    setDealModalOpen(false);
    setNewBrandName("");
    setNewCampaignTitle("");
    setNewDueDate("");
  };

  // Pipeline metrics
  const totalPipelineValue = deals.reduce((acc, d) => acc + d.amountIdr, 0);
  const pendingPaymentValue = deals
    .filter((d) => d.status === "pending_payment")
    .reduce((acc, d) => acc + d.amountIdr, 0);
  const settledRevenue = deals
    .filter((d) => d.status === "completed")
    .reduce((acc, d) => acc + d.amountIdr, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Monetization Hub
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[11px] font-mono">
              Sponsorship & Revenue
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Kalkulator rate card profesional, manajemen pipeline brand endorsement, dan strategi monetisasi kreator.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-card border border-border/80">
          <button
            onClick={() => setActiveTab("calculator")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeTab === "calculator"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Kalkulator Rate Card</span>
          </button>

          <button
            onClick={() => setActiveTab("deals")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeTab === "deals"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Pipeline Brand Deal ({deals.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("affiliate")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeTab === "affiliate"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Affiliate & Komisi</span>
          </button>

          <button
            onClick={() => setActiveTab("roadmap")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeTab === "roadmap"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Coins className="h-3.5 w-3.5" />
            <span>Roadmap Monetisasi</span>
          </button>
        </div>
      </div>

      {/* 2. Top Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Briefcase className="h-4 w-4 text-primary" />
            <span>Total Pipeline Deal</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums">
            Rp {totalPipelineValue.toLocaleString("id-ID")}
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Clock className="h-4 w-4 text-amber-500" />
            <span>Menunggu Bayar</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-500 font-mono tabular-nums">
            Rp {pendingPaymentValue.toLocaleString("id-ID")}
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Pendapatan Selesai</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-500 font-mono tabular-nums">
            Rp {settledRevenue.toLocaleString("id-ID")}
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Calculator className="h-4 w-4 text-indigo-500" />
            <span>Estimasi Rate/Post</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-500 font-mono tabular-nums">
            Rp {estimatedTikTokReelsRate.toLocaleString("id-ID")}
          </div>
        </Card>
      </div>

      {/* TAB 1: KALKULATOR RATE CARD */}
      {activeTab === "calculator" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Input Parameters */}
          <Card className="lg:col-span-2 border-border/80 bg-card/60 p-6 space-y-5">
            <div>
              <CardTitle className="text-base font-bold">Kalkulator Estimasi Rate Card</CardTitle>
              <CardDescription className="text-xs">
                Formula dinamis berdasarkan standar industri influencer marketing Indonesia (CPM niche, retensi views, dan hak cipta iklan).
              </CardDescription>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Kategori Niche Konten</label>
                <select
                  value={selectedNicheKey}
                  onChange={(e) => setSelectedNicheKey(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background/60 px-3 py-1 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  {Object.entries(NICHE_MULTIPLIERS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Total Pengikut (Followers)</label>
                <Input
                  type="number"
                  value={followerCount}
                  onChange={(e) => setFollowerCount(Math.max(100, Number(e.target.value)))}
                  className="font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Rata-rata Views per Video (30 Hari Terakhir)</label>
                <Input
                  type="number"
                  value={avgViews}
                  onChange={(e) => setAvgViews(Math.max(100, Number(e.target.value)))}
                  className="font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Engagement Rate (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={engagementRate}
                  onChange={(e) => setEngagementRate(Math.max(0.5, Number(e.target.value)))}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/60">
              <input
                type="checkbox"
                id="usageRightsCheck"
                checked={includeUsageRights}
                onChange={(e) => setIncludeUsageRights(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="usageRightsCheck" className="text-xs text-foreground font-medium cursor-pointer">
                Sertakan biaya lisensi iklan berbayar (Usage Rights 30 Hari: +30% dari rate dasar)
              </label>
            </div>
          </Card>

          {/* Rate Card Proposal Card */}
          <Card className="border-primary/25 bg-primary/5 p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  <span className="font-bold text-sm text-foreground">Hasil Estimasi Rate</span>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                  IDR Standar
                </Badge>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">TikTok / IG Reels (60s):</span>
                  <strong className="font-mono text-foreground tabular-nums">
                    Rp {estimatedTikTokReelsRate.toLocaleString("id-ID")}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">YouTube Shorts:</span>
                  <strong className="font-mono text-foreground tabular-nums">
                    Rp {estimatedShortsRate.toLocaleString("id-ID")}
                  </strong>
                </div>

                <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60">
                  <span className="text-muted-foreground">YouTube Dedicated (3-5 min):</span>
                  <strong className="font-mono text-foreground tabular-nums">
                    Rp {estimatedDedicatedYoutubeRate.toLocaleString("id-ID")}
                  </strong>
                </div>

                {includeUsageRights && (
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-border/60 text-primary">
                    <span>Usage Rights (30 Hari):</span>
                    <strong className="font-mono tabular-nums">
                      +Rp {usageRightsFee.toLocaleString("id-ID")}
                    </strong>
                  </div>
                )}
              </div>

              <div className="pt-2 text-center p-3 rounded-lg bg-card/80 border border-primary/20">
                <div className="text-[11px] text-muted-foreground">Rekomendasi Paket Kolaborasi:</div>
                <div className="text-xl font-extrabold text-primary font-mono tabular-nums mt-0.5">
                  Rp {totalPackageRate.toLocaleString("id-ID")}
                </div>
              </div>
            </div>

            <Button onClick={handleCopyRateCard} className="w-full gap-2 shadow-xs">
              {isCopied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-300" />
                  <span>Rate Card Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Salin Ringkasan Rate Card</span>
                </>
              )}
            </Button>
          </Card>
        </div>
      )}

      {/* TAB 2: PIPELINE BRAND DEALS */}
      {activeTab === "deals" && (
        <Card className="border-border/80 bg-card/60 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold">Pipeline Endorsement & Kolaborasi</CardTitle>
              <CardDescription className="text-xs">
                Pantau setiap tahapan kesepakatan kerjasama brand dari negosiasi hingga pencairan dana.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setDealModalOpen(true)} className="gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Deal Baru</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/80 text-muted-foreground bg-muted/20">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Nama Brand & Kampanye</th>
                  <th className="py-2.5 px-3 font-semibold">Platform</th>
                  <th className="py-2.5 px-3 font-semibold">Nilai Deal (IDR)</th>
                  <th className="py-2.5 px-3 font-semibold">Tenggat Waktu</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {deals.map((deal) => {
                  const statusConf = STATUS_CONFIGS[deal.status];

                  return (
                    <tr key={deal.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">{deal.brandName}</div>
                        <div className="text-[11px] text-muted-foreground">{deal.campaignTitle}</div>
                      </td>
                      <td className="py-3 px-3 capitalize font-medium">{deal.platform}</td>
                      <td className="py-3 px-3 font-mono font-bold tabular-nums">
                        Rp {deal.amountIdr.toLocaleString("id-ID")}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground font-mono">{deal.dueDate}</td>
                      <td className="py-3 px-3">
                        <Badge variant={statusConf.badgeVariant} className="text-[10px]">
                          {statusConf.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const nextStatuses: Record<BrandDeal["status"], BrandDeal["status"]> = {
                              prospecting: "negotiating",
                              negotiating: "in_production",
                              in_production: "pending_payment",
                              pending_payment: "completed",
                              completed: "completed",
                            };
                            const next = nextStatuses[deal.status];
                            setDeals((prev) =>
                              prev.map((d) => (d.id === deal.id ? { ...d, status: next } : d))
                            );
                            toast.success(`Status ${deal.brandName} diperbarui ke: ${STATUS_CONFIGS[next].label}`);
                          }}
                          className="h-7 text-[11px]"
                        >
                          Lanjut Status
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: AFFILIATE & KOMISI */}
      {activeTab === "affiliate" && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-border/80 bg-card/60 p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500 font-bold">
                T
              </span>
              <span>TikTok Shop Creator</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tautkan keranjang kuning di video pendek berdurasi 30-60 detik. Rata-rata komisi produk fisik berkisar 8% - 15%.
            </p>
            <div className="pt-2 text-xs text-muted-foreground flex justify-between border-t border-border/60">
              <span>Estimasi Konversi:</span>
              <strong className="text-foreground font-mono">1.8% - 3.2%</strong>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/60 p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 font-bold">
                S
              </span>
              <span>Shopee Video & Live</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tingkatkan penghasilan dengan menyematkan link affiliate di bio atau keranjang Shopee Video dengan voucher gratis ongkir.
            </p>
            <div className="pt-2 text-xs text-muted-foreground flex justify-between border-t border-border/60">
              <span>Rata-rata Komisi:</span>
              <strong className="text-foreground font-mono">5% - 10%</strong>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/60 p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 font-bold">
                D
              </span>
              <span>Produk Digital & Template</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Jual template naskah, panduan PDF, atau preset kreasi Anda sendiri. Margin keuntungan tertinggi hingga 90%+.
            </p>
            <div className="pt-2 text-xs text-muted-foreground flex justify-between border-t border-border/60">
              <span>Margin Keuntungan:</span>
              <strong className="text-foreground font-mono">85% - 95%</strong>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: ROADMAP MONETISASI */}
      {activeTab === "roadmap" && (
        <Card className="border-border/80 bg-card/60 p-6 space-y-6">
          <div>
            <CardTitle className="text-base font-bold">Tahapan Monetisasi Berkelanjutan</CardTitle>
            <CardDescription className="text-xs">
              Alur realistis mengembangkan akun media sosial menjadi mesin pendapatan yang konsisten.
            </CardDescription>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-xl border border-border/70 bg-card/90 space-y-2">
              <Badge variant="outline" className="text-[10px]">Level 1: 0 - 5.000 Followers</Badge>
              <h4 className="font-semibold text-sm text-foreground">Fondasi & Affiliate Starter</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fokus validasi pilar konten dan bangun trust. Mulai monetisasi lewat tautan affiliate produk yang benar-benar Anda pakai.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
              <Badge variant="default" className="text-[10px]">Level 2: 5.000 - 50.000 Followers</Badge>
              <h4 className="font-semibold text-sm text-foreground">Paid Endorsement & Barter</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kirimkan rate card resmi ke brand lokal. Tawarkan paket bundling (1 Video TikTok + 1 IG Reels + Hak Iklan 30 Hari).
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/70 bg-card/90 space-y-2">
              <Badge variant="outline" className="text-[10px]">Level 3: 50.000+ Followers</Badge>
              <h4 className="font-semibold text-sm text-foreground">Brand Ambassador & Digital Products</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kontrak jangka panjang (retainer 3-6 bulan), peluncuran produk digital milik sendiri, webinar berbayar, atau kursus mikro.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Modal Tambah Brand Deal Baru */}
      <Dialog open={dealModalOpen} onOpenChange={setDealModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Tambah Kesepakatan Brand Baru</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddBrandDeal} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Nama Brand / Klien</label>
              <Input
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Contoh: Tokopedia, Erigo, Bank Jago"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Judul / Bentuk Kampanye</label>
              <Input
                value={newCampaignTitle}
                onChange={(e) => setNewCampaignTitle(e.target.value)}
                placeholder="Contoh: 1x Dedicated TikTok Video Promo 11.11"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Platform</label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background/60 px-3 py-1 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary/25 capitalize"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="shopee">Shopee</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Nilai Deal (IDR)</label>
                <Input
                  type="number"
                  value={newAmountIdr}
                  onChange={(e) => setNewAmountIdr(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Status Awal</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background/60 px-3 py-1 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <option value="prospecting">Penjajakan</option>
                  <option value="negotiating">Negosiasi</option>
                  <option value="in_production">Produksi</option>
                  <option value="pending_payment">Menunggu Bayar</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Tenggat Waktu (Due Date)</label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDealModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm">
                Simpan ke Pipeline
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
