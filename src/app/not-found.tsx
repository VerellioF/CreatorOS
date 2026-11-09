import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-4">
        <Compass className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
        404 — Halaman Tidak Ditemukan
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        Halaman yang Anda tuju mungkin telah dipindahkan, sedang dikembangkan di fase berikutnya, atau URL tidak valid.
      </p>
      <Link href="/dashboard">
        <Button size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Dashboard</span>
        </Button>
      </Link>
    </div>
  );
}
