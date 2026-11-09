"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { signInAction } from "@/features/auth/actions";
import { sanitizeRedirectPath } from "@/lib/security/sanitize";
import { toast } from "sonner";
import { ArrowRight, Lock, Mail, Sparkles } from "lucide-react";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectPath(searchParams.get("redirectTo"), "/dashboard");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDemoLoading, setIsDemoLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signInAction({ email, password });

      if (!result.success) {
        setError(result.error || "Gagal masuk. Periksa kembali email dan password Anda.");
        toast.error("Gagal masuk");
      } else {
        toast.success("Berhasil masuk!");
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan sistem yang tidak terduga.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setIsDemoLoading(true);
    toast.info("Mengakses mode demo...");
    router.push("/demo");
  };

  return (
    <Card className="border-border/80 bg-card/95 backdrop-blur-sm shadow-xl">
      <form onSubmit={handleSubmit}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold tracking-tight">Masuk ke CreatorOS AI</CardTitle>
          <CardDescription className="text-xs">
            Kelola strategi, ide, dan produksi konten Anda dalam satu tempat.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Email</span>
            </label>
            <Input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading || isDemoLoading}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Password</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-primary hover:underline"
              >
                Lupa Password?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading || isDemoLoading}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full gap-2" isLoading={isLoading} disabled={isDemoLoading}>
            <span>Masuk ke Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="relative w-full my-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-card px-2 text-muted-foreground font-medium">Akses Cepat</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-primary/30 hover:bg-primary/5 hover:border-primary/50 text-xs font-semibold"
            onClick={handleDemoLogin}
            isLoading={isDemoLoading}
            disabled={isLoading}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Masuk sebagai User Demo (1-Click)</span>
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-1">
            Belum memiliki akun?{" "}
            <Link href="/sign-up" className="font-semibold text-primary hover:underline">
              Daftar Sekarang
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
