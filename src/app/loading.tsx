import * as React from "react";
import { Sparkles } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground selection:bg-primary/20">
      <div className="flex flex-col items-center gap-4 animate-in fade-in-50 duration-200">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg animate-pulse">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
          <span>Memuat CreatorOS AI...</span>
        </div>
      </div>
    </div>
  );
}
