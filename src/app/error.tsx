"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Runtime application error:", error);
  }, [error]);

  const safeMessage =
    process.env.NODE_ENV === "production"
      ? "Aplikasi mengalami gangguan tak terduga. Silakan muat ulang halaman atau coba beberapa saat lagi."
      : error.message || "Aplikasi mengalami kegagalan tak terduga.";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
        Terjadi Kesalahan Sistem
      </h2>
      <p className="text-xs text-muted-foreground max-w-md mb-2 leading-relaxed">
        {safeMessage}
      </p>
      {error.digest && (
        <p className="text-[11px] font-mono text-muted-foreground/80 mb-6">
          Kode Referensi: {error.digest}
        </p>
      )}
      {!error.digest && <div className="mb-4" />}
      <Button onClick={() => reset()} size="sm" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        <span>Muat Ulang Halaman</span>
      </Button>
    </div>
  );
}
