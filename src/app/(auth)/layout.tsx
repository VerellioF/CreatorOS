import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background p-4 sm:p-8 overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Subtle Ambient Background Glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/10 dark:bg-primary/15 rounded-full blur-[120px] -z-10" />

      {/* Top Bar */}
      <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            CreatorOS <span className="text-primary font-extrabold">AI</span>
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main Centered Content */}
      <div className="flex items-center justify-center w-full my-auto py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-6xl mx-auto text-center text-xs text-muted-foreground py-4">
        &copy; {new Date().getFullYear()} CreatorOS AI. Content Creation Operating System.
      </div>
    </div>
  );
}
