import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Compass, Sparkles } from "lucide-react";

export default function NicheDiscoveryPage() {
  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-300">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Niche Discovery & Market Fit
            </h1>
            <Badge variant="comingSoon" className="text-xs">
              Fase 2 Pipeline
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Temukan ceruk pasar potensial dengan algoritma evaluasi demand dan kompetisi.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Discovery Engine</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Modul analisis niche berbasis data pasar nyata akan diaktifkan pada Fase 2.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Sparkles}
            title="Niche Discovery Engine"
            description="Algoritma scoring demand, densitas kompetitor, dan estimasi potensi monetisasi niche sedang disiapkan untuk Fase 2."
            className="p-12"
          />
        </CardContent>
      </Card>
    </div>
  );
}
