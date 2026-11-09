"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { WorkspaceWithRole } from "@/services/workspace-service";
import { createWorkspaceAction, switchWorkspaceAction } from "@/features/workspace/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceWithRole[];
  currentWorkspaceId?: string;
}

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [mode, setMode] = React.useState<"creator" | "affiliate" | "business" | "personal_brand">("creator");

  const currentWorkspace =
    workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      toast.error("Nama dan slug workspace wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createWorkspaceAction({
        name,
        slug,
        creatorMode: mode,
      });

      if (!result.success) {
        toast.error(result.error || "Gagal membuat workspace");
      } else {
        toast.success("Workspace berhasil dibuat!");
        setIsDialogOpen(false);
        setName("");
        setSlug("");
        router.refresh();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    setIsOpen(false);
    if (workspaceId === currentWorkspace?.id) {
      return;
    }

    try {
      const result = await switchWorkspaceAction(workspaceId);
      if (!result.success) {
        toast.error(result.error || "Gagal berpindah workspace");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan saat berpindah workspace");
    }
  };

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="w-56 justify-between border-border bg-card/50 text-left font-normal"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
              <Building2 className="h-3 w-3" />
            </div>
            <span className="truncate font-medium text-xs">
              {currentWorkspace ? currentWorkspace.name : "Pilih Workspace"}
            </span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 opacity-50" />
        </Button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in-80">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Workspace Anda
              </div>
              <div className="space-y-0.5">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitchWorkspace(ws.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold uppercase">
                        {ws.name.slice(0, 2)}
                      </div>
                      <span className="truncate">{ws.name}</span>
                    </div>
                    {ws.id === currentWorkspace?.id && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              <div className="my-1 border-t border-border" />

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsDialogOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Buat Workspace Baru</span>
              </button>
            </div>
          </>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateWorkspace}>
            <DialogHeader>
              <DialogTitle>Buat Workspace Baru</DialogTitle>
              <DialogDescription>
                Workspace memungkinkan Anda mengorganisir strategi dan aset konten secara terpisah.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Nama Workspace
                </label>
                <Input
                  placeholder="Contoh: Creator Brand Studio"
                  value={name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setName(nextName);
                    if (!slug) {
                      setSlug(
                        nextName
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                          .slice(0, 50)
                      );
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Workspace Slug (URL Identifier)
                </label>
                <Input
                  placeholder="creator-brand-studio"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Creator Mode
                </label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="creator">Creator Mode (Audience Growth & Personal)</option>
                  <option value="affiliate">Affiliate Mode (Review & Conversion)</option>
                  <option value="business">Business Mode (Brand Marketing & Campaigns)</option>
                  <option value="personal_brand">Personal Brand Mode (Authority & Expertise)</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Buat Workspace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
