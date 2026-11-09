"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { forgotPasswordAction } from "@/features/auth/actions";
import { toast } from "sonner";
import { ArrowLeft, Mail, Send } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await forgotPasswordAction({ email });

      if (!result.success) {
        setError(result.error || "Gagal mengirim link reset password.");
        toast.error("Gagal mengirim link");
      } else {
        setIsSuccess(true);
        toast.success("Link reset password terkirim!");
      }
    } catch {
      setError("Terjadi kesalahan sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-border shadow-xl">
      <form onSubmit={handleSubmit}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight">Lupa Password</CardTitle>
          <CardDescription className="text-xs">
            Masukkan email Anda untuk menerima instruksi reset password.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {isSuccess ? (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                Email Terkirim!
              </p>
              <p className="text-[11px] text-muted-foreground">
                Silakan periksa kotak masuk atau spam email Anda untuk petunjuk pemulihan kata sandi.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Email Terdaftar</span>
              </label>
              <Input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {!isSuccess && (
            <Button type="submit" className="w-full gap-2" isLoading={isLoading}>
              <span>Kirim Link Reset</span>
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}

          <Link
            href="/sign-in"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Halaman Masuk</span>
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
