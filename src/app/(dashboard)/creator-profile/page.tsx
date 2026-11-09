import * as React from "react";
import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { User, Sparkles, Dna } from "lucide-react";

export default async function CreatorProfilePage() {
  const user = await AuthService.getCurrentUser();
  const profile = user ? await ProfileService.getProfile(user.id) : null;

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-300">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Creator Profile & DNA
            </h1>
            <Badge variant="comingSoon" className="text-xs">
              Fase 2 Pipeline
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Fondasi tone of voice, kepribadian konten, dan positioning Anda di hadapan audiens.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Identity Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Identitas Pengguna</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Data akun yang tersinkronisasi di Supabase Auth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Nama:</span>
              <span className="font-semibold text-foreground">{profile?.full_name || "-"}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-semibold text-foreground">{user?.email || "-"}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Bahasa Pilihan:</span>
              <span className="font-semibold text-foreground uppercase">{profile?.preferred_language || "ID"}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Status Onboarding:</span>
              <Badge variant={profile?.onboarding_completed ? "success" : "secondary"} className="text-[10px]">
                {profile?.onboarding_completed ? "Selesai" : "Belum Onboarding"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Creator DNA Card (Fase 2 Preview) */}
        <Card className="border-primary/20 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">Creator DNA Synthesis</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Sintesis otomatis dari AI Onboarding Interview (Segera hadir di Fase 2).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Sparkles}
              title="Creator DNA Belum Dihasilkan"
              description="Fitur wawancara AI mendalam untuk mengekstrak tone of voice dan arketipe konten Anda akan diimplementasikan di Fase 2."
              className="p-6"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
