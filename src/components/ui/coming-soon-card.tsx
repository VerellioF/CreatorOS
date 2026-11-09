import * as React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, LayoutDashboard, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/utils";

interface ComingSoonCardProps {
  featureName: string;
  categoryName?: string;
  description?: string;
}

export function ComingSoonCard({
  featureName,
  categoryName = "Fitur Lanjutan",
  description,
}: ComingSoonCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[500px] p-6 animate-in fade-in-50 duration-300">
      <Card className="max-w-xl w-full border-border bg-card/70 backdrop-blur-xs text-center shadow-lg">
        <CardHeader className="space-y-4 pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-xs">
            <Sparkles className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground border-border">
                {categoryName}
              </Badge>
              <Badge variant="comingSoon" className="text-[10px] px-2 py-0.5 font-mono">
                Segera Hadir
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {featureName} Sedang Difinalisasi
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              {description ||
                "Fitur ini disiapkan untuk pembaruan berikutnya setelah fase validasi pasar. Di fase Public Beta ini, mari fokus menghasilkan naskah viral dan rencana konten terbaik Anda secara gratis!"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          <div className="rounded-lg bg-muted/30 border border-border/60 p-4 text-xs text-muted-foreground text-left space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>✨ Fitur Esensial yang Aktif 100%:</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Creator Profile & DNA</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Niche Discovery Engine</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Idea Generator & Backlog</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Script Studio (Hooks & Naskah)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Content Calendar</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>AI Assistant Mentoring</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/studio/scripts"
              className={cn(buttonVariants({ variant: "default" }), "w-full sm:w-auto gap-2")}
            >
              <FileText className="h-4 w-4" />
              <span>Buka Script Studio</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto gap-2")}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Ke Dashboard</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
