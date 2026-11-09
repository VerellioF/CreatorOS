"use client";

import React from "react";
import { ShieldCheck, Lock, Eye, Database, Server, RefreshCw, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 pb-20">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
            UU No. 27/2022 PDP Terpenuhi
          </Badge>
          <span className="text-xs text-muted-foreground">Berlaku Efektif: 31 Oktober 2026</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Kebijakan Privasi (Privacy Policy)</h1>
        <p className="text-muted-foreground">
          Transparansi penuh atas pemrosesan data, perlindungan kerahasiaan prompt AI, dan hak privasi kreator Anda.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">1. Prinsip Perlindungan & Komitmen Nol Pelatihan AI</CardTitle>
                <CardDescription>Keamanan data prompt dan intellectual property Anda</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              CreatorOS AI berkomitmen penuh melindungi hak kekayaan intelektual (IP) Anda. Kami secara tegas
              menetapkan bahwa:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/90">
              <li>
                <strong>Nol Pelatihan AI (No AI Model Training):</strong> Prompt, Creator DNA, skrip, storyboard, audio,
                dan aset video yang Anda unggah <strong>TIDAK PERNAH</strong> digunakan untuk melatih model publik AI
                (Gemini, OpenAI, Anthropic, ElevenLabs).
              </li>
              <li>
                <strong>Kerahasiaan Tenant:</strong> Setiap workspace diisolasi secara kriptografis menggunakan
                Row Level Security (RLS) PostgreSQL tingkat enterprise. Anggota workspace lain tidak dapat mengakses data Anda.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">2. Data Yang Kami Kumpulkan & Dasar Pemrosesan</CardTitle>
                <CardDescription>Sesuai asas minimalisasi data UU PDP Pasal 16</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>Kami hanya mengumpulkan data yang mutlak diperlukan untuk operasional SaaS:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-1">
                <p className="font-semibold text-foreground">Data Akun & Profil</p>
                <p className="text-xs">Nama, alamat email, preferensi tema, bahasa, dan foto avatar dari Supabase Auth.</p>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-1">
                <p className="font-semibold text-foreground">Creator DNA & Riset</p>
                <p className="text-xs">Tone of voice, pilar konten, target audiens, dan riwayat ide yang Anda simpan.</p>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-1">
                <p className="font-semibold text-foreground">Transaksi & Billing</p>
                <p className="text-xs">Order ID Midtrans, status transaksi, tier langganan. Kami tidak menyimpan nomor kartu kredit Anda.</p>
              </div>
              <div className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-1">
                <p className="font-semibold text-foreground">Metrik Kinerja Konten</p>
                <p className="text-xs">Views, likes, shares, dan analitik yang Anda hubungkan atau input secara manual.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">3. Sub-Prosesor Pihak Ketiga Tepercaya</CardTitle>
                <CardDescription>Layanan infrastruktur bersertifikasi ISO 27001 dan SOC 2</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>Untuk menjalankan fitur CreatorOS AI, kami bermitra dengan sub-prosesor resmi:</p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/90">
              <li><strong>Supabase Inc.</strong> — Basis data terisolasi PostgreSQL & otentikasi.</li>
              <li><strong>PT Midtrans (GoTo Financial)</strong> — Gerbang pembayaran QRIS, Virtual Account, & Kartu Kredit.</li>
              <li><strong>Google Cloud Platform</strong> — Inferensi LLM terverifikasi (Gemini API) dengan enkripsi TLS 1.3.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">4. Kebijakan Retensi Data & Hak Penghapusan</CardTitle>
                <CardDescription>Hak untuk dilupakan (Right to be Forgotten)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Sesuai kebijakan retensi otomatis kami: log sementara dibersihkan setiap 90 hari, dan file render sementara
              setiap 30 hari. Anda berhak mengajukan penghapusan akun dan seluruh aset secara permanen kapan saja melalui
              menu Pengaturan atau melalui tiket bantuan di Pusat Bantuan.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Mail className="w-4 h-4 text-primary" />
              <span className="text-xs text-foreground font-medium">Petugas Perlindungan Data (DPO): dpo@creatoros.ai</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
