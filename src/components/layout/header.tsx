import * as React from "react";
import { Search, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserNav } from "./user-nav";
import type { WorkspaceWithRole } from "@/services/workspace-service";

interface HeaderProps {
  workspaces: WorkspaceWithRole[];
  currentWorkspaceId?: string;
  user: {
    email?: string;
    fullName?: string;
  };
}

export function Header({ workspaces, currentWorkspaceId, user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspaceId}
        />

        <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5 opacity-60" />
          <span>Cari fitur, strategi, atau ide...</span>
          <kbd className="ml-4 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Credit Badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          <span>50 Kredit</span>
        </div>

        <ThemeToggle />

        <div className="h-4 w-px bg-border" />

        <UserNav user={user} />
      </div>
    </header>
  );
}
