"use client";

import React from "react";
import { FileText, ShieldAlert, Coins, Sparkles, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6 pb-20">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
            Perjanjian Layanan SaaS
          </Badge>
          <span className="text-xs text-muted-foreground">Pembaruan Terakhir: 31 Oktober 2026</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Syarat & Ketentuan Layanan (Terms of Service)</h1>
        <p className="text-muted-foreground">
          Ketentuan penggunaan platform CreatorOS AI, kepemilikan hak cipta aset, dan kebijakan transaksi SaaS.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">1. Penerimaan Ketentuan & Akun Pengguna</CardTitle>
                <CardDescription>Pendaftaran dan tanggung jawab keamanan kredensial</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Dengan mendaftar, mengakses, atau menggunakan layanan CreatorOS AI, Anda menyatakan telah berusia
              minimal 18 tahun (atau didampingi wali sah) dan setuju terikat pada seluruh syarat dan ketentuan ini.
            </p>
            <p>
              Anda bertanggung jawab penuh atas keamanan sandi, akses workspace, dan setiap tindakan yang dilakukan
              melalui akun Anda. Apabila terdeteksi aktivitas mencurigakan, segera hubungi tim dukungan kami.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">2. Hak Kekayaan Intelektual & Kepemilikan Konten</CardTitle>
                <CardDescription>Kreator memegang 100% hak kepemilikan hasil karya</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong>Kepemilikan Kreator:</strong> Seluruh output yang dihasilkan melalui fitur CreatorOS AI
              (skrip video, transkrip, storyboard, audio synthesis, gambar, dan video yang diekspor) adalah
              <strong> milik sah Anda 100%</strong>. Anda berhak mengomersialkan, mempublikasikan, atau memonetisasi
              konten tersebut tanpa kewajiban royalti kepada CreatorOS AI.
            </p>
            <p>
              <strong>Hak Lisensi Operasional:</strong> Anda memberi CreatorOS AI lisensi non-eksklusif hanya untuk
              menyimpan, menyalin, dan memproses aset tersebut dalam rangka menjalankan fungsionalitas aplikasi
              untuk workspace Anda.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">3. Langganan, Pembayaran Midtrans & Kredit AI</CardTitle>
                <CardDescription>Kebijakan kuota, perpanjangan, dan pengembalian kredit</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <ul className="list-disc pl-5 space-y-2 text-foreground/90">
              <li>
                <strong>Pembayaran:</strong> Pembayaran langganan (Creator Pro, Studio, Enterprise) diproses melalui
                Midtrans dengan metode QRIS, Virtual Account bank, dan Kartu Kredit secara aman.
              </li>
              <li>
                <strong>Sistem Kredit AI:</strong> Setiap eksekusi AI (generasi skrip, gambar, voice, rendering video,
                analitik cerdas) mendebit kredit wallet workspace secara atomik.
              </li>
              <li>
                <strong>Kebijakan Refund Kredit:</strong> Jika proses rendering media gagal akibat galat teknis sistem,
                kredit yang terpotong akan dikembalikan (refund) secara otomatis ke wallet Anda.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">4. Batasan Penggunaan (Acceptable Use Policy)</CardTitle>
                <CardDescription>Larangan konten terlarang dan aktivitas berbahaya</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>Anda dilarang keras menggunakan AI kami untuk menghasilkan:</p>
            <ul className="list-disc pl-5 space-y-1 text-foreground/90">
              <li>Konten penipuan (scam), skema ponzi, atau klaim finansial menyesatkan yang dilarang OJK/Bappebti.</li>
              <li>Konten ujaran kebencian, diskriminasi SARA, pornografi, atau pelecehan individu.</li>
              <li>Deepfake tanpa izin atau pelanggaran hak privasi/hak cipta pihak ketiga.</li>
            </ul>
            <p className="text-xs pt-1">
              Pelanggaran terhadap ketentuan ini berakibat pada penangguhan langsung akun tanpa pengembalian dana langganan.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">5. Hukum Yang Berlaku & Penyelesaian Sengketa</CardTitle>
                <CardDescription>Yurisdiksi hukum Republik Indonesia</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Syarat dan Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Republik Indonesia. Setiap perselisihan
              yang timbul akan diupayakan diselesaikan terlebih dahulu secara musyawarah untuk mufakat. Apabila tidak
              tercapai kesepakatan, sengketa akan diselesaikan melalui Pengadilan Negeri Jakarta Selatan.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
