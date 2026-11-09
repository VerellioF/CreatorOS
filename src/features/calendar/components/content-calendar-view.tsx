"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  Share2,
  Video,
  Sparkles,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils/utils";

interface CalendarJob {
  id: string;
  title: string;
  platform: "tiktok" | "instagram" | "youtube" | "facebook" | "shopee";
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_for?: string | null;
  caption?: string | null;
}

interface ContentPackageOption {
  id: string;
  title: string;
  pillarName?: string;
}

interface ContentCalendarViewProps {
  workspaceId: string;
  initialJobs?: CalendarJob[];
  contentPackages?: ContentPackageOption[];
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  tiktok: { bg: "bg-pink-500/15 border-pink-500/30 text-pink-500", text: "text-pink-500", label: "TikTok" },
  instagram: { bg: "bg-purple-500/15 border-purple-500/30 text-purple-500", text: "text-purple-500", label: "Instagram" },
  youtube: { bg: "bg-red-500/15 border-red-500/30 text-red-500", text: "text-red-500", label: "YouTube" },
  shopee: { bg: "bg-orange-500/15 border-orange-500/30 text-orange-500", text: "text-orange-500", label: "Shopee" },
  facebook: { bg: "bg-blue-500/15 border-blue-500/30 text-blue-500", text: "text-blue-500", label: "Facebook" },
};

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function ContentCalendarView({
  workspaceId,
  initialJobs = [],
  contentPackages = [],
}: ContentCalendarViewProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [jobs, setJobs] = React.useState<CalendarJob[]>(initialJobs);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [platformFilter, setPlatformFilter] = React.useState<string>("all");

  // Form states
  const [formTitle, setFormTitle] = React.useState("");
  const [formPlatform, setFormPlatform] = React.useState<"tiktok" | "instagram" | "youtube" | "facebook" | "shopee">("tiktok");
  const [formDateTime, setFormDateTime] = React.useState("");
  const [formCaption, setFormCaption] = React.useState("");
  const [formSelectedPackage, setFormSelectedPackage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate calendar grid days
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDayIndex + 6) % 7; // Monday = 0

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleOpenScheduleForDay = (day: number) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(formattedDate);
    setFormDateTime(`${formattedDate}T19:00`);
    setModalOpen(true);
  };

  const handlePackageSelect = (packageId: string) => {
    setFormSelectedPackage(packageId);
    const found = contentPackages.find((p) => p.id === packageId);
    if (found) {
      setFormTitle(found.title);
      setFormCaption(`Konten pilar: ${found.pillarName || "Utama"}\n\n#CreatorOS #${found.title.replace(/\s+/g, "")}`);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDateTime) {
      toast.error("Judul dan tanggal jadwal wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledIso = new Date(formDateTime).toISOString();

      const res = await fetch("/api/workspace/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: formTitle.trim(),
          caption: formCaption.trim(),
          platform: formPlatform,
          scheduledFor: scheduledIso,
          contentItemId: formSelectedPackage || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan jadwal");
      }

      toast.success("Konten berhasil dijadwalkan di kalender!");
      setJobs((prev) => [...prev, data.job]);
      setModalOpen(false);
      setFormTitle("");
      setFormCaption("");
      setFormSelectedPackage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan saat menjadwalkan");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter jobs by platform
  const filteredJobs = platformFilter === "all"
    ? jobs
    : jobs.filter((j) => j.platform === platformFilter);

  // Group jobs by day in the current viewed month
  const jobsByDay: Record<number, CalendarJob[]> = {};
  filteredJobs.forEach((job) => {
    if (!job.scheduled_for) return;
    const jobDate = new Date(job.scheduled_for);
    if (jobDate.getFullYear() === year && jobDate.getMonth() === month) {
      const dayNum = jobDate.getDate();
      if (!jobsByDay[dayNum]) jobsByDay[dayNum] = [];
      jobsByDay[dayNum].push(job);
    }
  });

  const totalThisMonth = Object.values(jobsByDay).reduce((acc, list) => acc + list.length, 0);
  const scheduledCount = filteredJobs.filter((j) => j.status === "scheduled").length;
  const publishedCount = filteredJobs.filter((j) => j.status === "published").length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Content Calendar
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[11px] font-mono">
              Kalender Interaktif
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Rencanakan jadwal tayang konten, distribusi multi-platform, dan jaga konsistensi posting mingguan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              const now = new Date();
              const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T19:00`;
              setFormDateTime(dateStr);
              setModalOpen(true);
            }}
            size="sm"
            className="gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Jadwalkan Konten</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span>Total Bulan Ini</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {totalThisMonth}
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Clock className="h-4 w-4 text-indigo-500" />
            <span>Terjadwal</span>
          </div>
          <div className="text-2xl font-bold text-indigo-500 font-mono tabular-nums">
            {scheduledCount}
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Terpublikasi</span>
          </div>
          <div className="text-2xl font-bold text-emerald-500 font-mono tabular-nums">
            {publishedCount}
          </div>
        </Card>

        <Card className="border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <FileText className="h-4 w-4 text-amber-500" />
            <span>Naskah Tersedia</span>
          </div>
          <div className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {contentPackages.length}
          </div>
        </Card>
      </div>

      {/* 3. Calendar Navigator & Platform Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/80">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="font-bold text-base text-foreground tracking-tight ml-1">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button variant="outline" size="sm" onClick={handleToday} className="h-7 text-xs ml-2">
            Hari Ini
          </Button>
        </div>

        {/* Filter Platform */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] text-muted-foreground mr-1 hidden md:inline">Platform:</span>
          {["all", "tiktok", "instagram", "youtube", "shopee"].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors",
                platformFilter === p
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {p === "all" ? "Semua Platform" : p}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Calendar Month Grid */}
      <div className="rounded-xl border border-border/80 bg-card/60 overflow-hidden shadow-xs">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-border/80 bg-muted/30 text-center py-2 text-xs font-semibold text-muted-foreground">
          {DAY_NAMES.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-[110px] divide-x divide-y divide-border/60">
          {/* Empty cells before month start */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-muted/10 p-2 text-xs text-muted-foreground/30 select-none" />
          ))}

          {/* Actual days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayJobs = jobsByDay[dayNum] || [];
            const isToday =
              new Date().getDate() === dayNum &&
              new Date().getMonth() === month &&
              new Date().getFullYear() === year;

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => handleOpenScheduleForDay(dayNum)}
                className={cn(
                  "p-2 flex flex-col justify-between hover:bg-accent/40 cursor-pointer transition-colors group relative overflow-hidden",
                  isToday && "bg-primary/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold font-mono",
                      isToday
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px]"
                        : "text-foreground group-hover:text-primary transition-colors"
                    )}
                  >
                    {dayNum}
                  </span>

                  <Plus className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Day Job Pills */}
                <div className="space-y-1 mt-1 overflow-y-auto max-h-[75px]">
                  {dayJobs.map((job) => {
                    const style = PLATFORM_COLORS[job.platform] || {
                      bg: "bg-muted text-foreground border-border",
                      label: job.platform,
                    };

                    return (
                      <div
                        key={job.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info(`Detail Konten: ${job.title} (${style.label})`);
                        }}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium border truncate flex items-center gap-1",
                          style.bg
                        )}
                        title={`${job.title} — ${style.label} (${job.status})`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                        <span className="truncate">{job.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Modal Jadwalkan Konten Baru */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Jadwalkan Konten Baru</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSchedule} className="space-y-4 pt-2">
            {/* Quick import from content packages */}
            {contentPackages.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Pilih dari Paket Naskah Tersedia (Opsional)</span>
                </label>
                <select
                  value={formSelectedPackage}
                  onChange={(e) => handlePackageSelect(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background/60 px-3 py-1 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <option value="">-- Buat Judul Bebas / Manual --</option>
                  {contentPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.title} ({pkg.pillarName || "Pilar Utama"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Judul Konten</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Contoh: 3 Tips Sukses Freelance dari Rumah"
                required
              />
            </div>

            {/* Platform & DateTime Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Platform Tujuan</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-background/60 px-3 py-1 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary/25 capitalize"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="shopee">Shopee</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Tanggal & Waktu</label>
                <Input
                  type="datetime-local"
                  value={formDateTime}
                  onChange={(e) => setFormDateTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Caption / Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Catatan / Caption Draft</label>
              <Textarea
                value={formCaption}
                onChange={(e) => setFormCaption(e.target.value)}
                placeholder="Catatan hook, CTA, atau hashtag..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan ke Kalender"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
