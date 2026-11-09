"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LifeBuoy,
  Plus,
  HelpCircle,
  MessageSquare,
  Send,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { SupportTicketItem } from "@/services/support-service";

const FAQS = [
  {
    q: "Bagaimana cara kerja sistem kredit AI di CreatorOS?",
    a: "Setiap pembuatan skrip, gambar, voiceover, dan rendering video mendebit kredit wallet workspace. Anda dapat memantau penggunaan di halaman Usage & Credits. Apabila render video gagal karena error teknis, kredit akan di-refund otomatis.",
  },
  {
    q: "Apakah metrik analitik di CreatorOS berasal dari data nyata?",
    a: "Ya, 100% data analitik berasal dari akun media sosial yang Anda hubungkan atau input manual yang telah Anda verifikasi. CreatorOS tidak pernah memalsukan metrik views, klik, atau konversi yang tidak tersedia.",
  },
  {
    q: "Apakah model AI publik dilatih menggunakan prompt dan data konten saya?",
    a: "Sama sekali tidak. CreatorOS AI menggunakan enterprise zero-data-retention APIs dari penyedia fondasi model (Google Gemini, OpenAI). Prompt, ide, dan video Anda tetap 100% rahasia milik Anda.",
  },
  {
    q: "Bagaimana jika pembayaran Midtrans QRIS saya belum terverifikasi?",
    a: "Verifikasi webhook Midtrans dilakukan secara otomatis dalam hitungan detik. Jika dalam 5 menit status paket belum berubah, silakan buat tiket di halaman ini dengan menyertakan Order ID.",
  },
];

export interface SupportViewProps {
  workspaceId: string;
  userId: string;
}

export function SupportView({ workspaceId, userId }: SupportViewProps) {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<"billing" | "bug" | "feature_request" | "account" | "content" | "other">("billing");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [message, setMessage] = useState("");

  const fetchTickets = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/support/tickets?workspaceId=${workspaceId}`);
      if (res.ok) {
        const json = await res.json();
        setTickets(json.tickets || []);
      }
    } catch {
      // offline / demo fallback
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error("Subjek dan pesan bantuan wajib diisi");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          subject,
          category,
          priority,
          message,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal membuat tiket bantuan");
      }

      const json = await res.json();
      toast.success(`Tiket bantuan ${json.ticket.ticketNumber} berhasil dibuat!`);
      setTickets((prev) => [json.ticket, ...prev]);
      setIsDialogOpen(false);
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">Menunggu Respon</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10">Diproses Tim</Badge>;
      case "resolved":
        return <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">Selesai</Badge>;
      default:
        return <Badge variant="outline">Ditutup</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Pusat Bantuan & Dukungan Kreator</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Dapatkan bantuan teknis cepat, panduan fitur, atau laporkan kendala operasional workspace Anda.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Buat Tiket Bantuan
        </Button>
      </div>

      {/* FAQ Accordion */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Pertanyaan Yang Sering Diajukan (FAQ)</CardTitle>
          </div>
          <CardDescription>Jawaban cepat untuk pertanyaan teknis dan operasional yang umum</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="border border-border/40 rounded-lg overflow-hidden transition-colors"
            >
              <button
                onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <span className="font-medium text-sm text-foreground">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                    openFaqIndex === idx ? "transform rotate-180" : ""
                  }`}
                />
              </button>
              {openFaqIndex === idx && (
                <div className="p-4 pt-0 text-sm text-muted-foreground leading-relaxed border-t border-border/20 bg-muted/10">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ticket History */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Riwayat Tiket Bantuan Anda</CardTitle>
              <CardDescription>Status penanganan kendala yang telah Anda laporkan</CardDescription>
            </div>
            <Badge variant="secondary">{tickets.length} Tiket</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Memuat tiket bantuan...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg border-border/60">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium">Belum ada tiket bantuan aktif</p>
              <p className="text-xs text-muted-foreground mt-1">
                Jika mengalami kendala operasional atau billing, buat tiket baru untuk menghubungi tim kami.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 rounded-lg border border-border/40 bg-background/50 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {ticket.ticketNumber}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {ticket.category}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs capitalize ${
                          ticket.priority === "urgent"
                            ? "bg-rose-500/20 text-rose-400"
                            : ticket.priority === "high"
                            ? "bg-amber-500/20 text-amber-400"
                            : ""
                        }`}
                      >
                        {ticket.priority}
                      </Badge>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">{ticket.subject}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{ticket.message}</p>
                  {ticket.resolutionNotes && (
                    <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                      <strong>Respon Tim:</strong> {ticket.resolutionNotes}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground/70">
                    Dibuat: {new Date(ticket.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Tiket Bantuan Baru</DialogTitle>
            <DialogDescription>
              Jelaskan kendala Anda secara spesifik agar tim kami dapat menyelesaikan secepat mungkin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Subjek Kendala</label>
              <Input
                placeholder="Contoh: Gagal upload video TikTok atau kuota kredit tidak sinkron"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="billing" className="bg-popover text-popover-foreground">Billing & Pembayaran</option>
                  <option value="bug" className="bg-popover text-popover-foreground">Bug Teknis</option>
                  <option value="content" className="bg-popover text-popover-foreground">Studio & Rendering</option>
                  <option value="account" className="bg-popover text-popover-foreground">Akun & Workspace</option>
                  <option value="feature_request" className="bg-popover text-popover-foreground">Permintaan Fitur</option>
                  <option value="other" className="bg-popover text-popover-foreground">Lainnya</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Prioritas</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="low" className="bg-popover text-popover-foreground">Rendah (Low)</option>
                  <option value="medium" className="bg-popover text-popover-foreground">Sedang (Medium)</option>
                  <option value="high" className="bg-popover text-popover-foreground">Tinggi (High)</option>
                  <option value="urgent" className="bg-popover text-popover-foreground">Mendesak (Urgent)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Pesan & Detail Masalah</label>
              <Textarea
                rows={4}
                placeholder="Uraikan langkah-langkah yang memicu kendala, pesan error yang tampil, atau ID order..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Tiket</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
