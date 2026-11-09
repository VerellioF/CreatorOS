"use client";

import * as React from "react";
import { LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/features/auth/actions";
import { toast } from "sonner";
import Link from "next/link";

interface UserNavProps {
  user: {
    email?: string;
    fullName?: string;
  };
}

export function UserNav({ user }: UserNavProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const displayName = user.fullName || user.email?.split("@")[0] || "Creator";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await Promise.allSettled([supabase.auth.signOut(), signOutAction()]);
      toast.success("Berhasil keluar");
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error("Gagal keluar dari sesi");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 rounded-full border border-border bg-card p-0 text-xs font-semibold"
      >
        <span>{initials}</span>
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in-80">
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>

            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Pengaturan Akun</span>
            </Link>

            <Link
              href="/creator-profile"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Profil Creator</span>
            </Link>

            <div className="my-1 border-t border-border" />

            <button
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isLoggingOut ? "Keluar..." : "Keluar (Sign Out)"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
