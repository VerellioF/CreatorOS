"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Sparkles, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserNav } from "./user-nav";
import { CommandPalette } from "./command-palette";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import type { WorkspaceWithRole } from "@/services/workspace-service";

interface HeaderProps {
  workspaces: WorkspaceWithRole[];
  currentWorkspaceId?: string;
  creditBalance?: number;
  user: {
    email?: string;
    fullName?: string;
    isSuperadmin?: boolean;
  };
}

export function Header({
  workspaces,
  currentWorkspaceId,
  creditBalance = 50,
  user,
}: HeaderProps) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-3 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex md:hidden items-center justify-center h-8 w-8 rounded-md border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            aria-label="Buka Menu Navigasi"
          >
            <Menu className="h-4 w-4" />
          </button>

          <WorkspaceSwitcher
            workspaces={workspaces}
            currentWorkspaceId={currentWorkspaceId}
          />

          {/* Desktop Interactive Command Palette Trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-card hover:text-foreground hover:border-primary/40 transition-colors group"
            title="Buka Pintasan Cepat (⌘K)"
          >
            <Search className="h-3.5 w-3.5 opacity-60 group-hover:text-primary transition-colors" />
            <span>Cari fitur, strategi, atau studio...</span>
            <kbd className="ml-4 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Search Button */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex md:hidden items-center justify-center h-8 w-8 rounded-md border border-border bg-card/60 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cari Cepat"
            title="Cari Cepat"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Live Credit Balance Badge */}
          <Link
            href="/usage"
            className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 hover:border-primary/40 transition-all duration-150 shadow-xs"
            title="Lihat rincian penggunaan token & kredit AI"
          >
            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
            <span className="font-mono font-bold tabular-nums">{creditBalance}</span>{" "}
            <span className="hidden sm:inline text-primary/80">Kredit</span>
          </Link>

          <ThemeToggle />

          <div className="h-4 w-px bg-border" />

          <UserNav user={user} />
        </div>
      </header>

      {/* Command Palette Modal */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        isSuperadmin={user.isSuperadmin}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        isSuperadmin={user.isSuperadmin}
      />
    </>
  );
}
