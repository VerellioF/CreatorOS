import * as React from "react";
import { useState } from "react";
import { Plus, Loader2, Save, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { PerformancePlatform } from "@/lib/supabase/types";

interface ManualEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSuccess: () => void;
}

export function ManualEntryDialog({
  isOpen,
  onClose,
  workspaceId,
  onSuccess,
}: ManualEntryDialogProps) {
  const [platform, setPlatform] = useState<PerformancePlatform>("tiktok");
  const [postTitle, setPostTitle] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(new Date().toISOString().split("T")[0]);
  const [views, setViews] = useState<number | "">("");
  const [likes, setLikes] = useState<number | "">("");
  const [comments, setComments] = useState<number | "">("");
  const [shares, setShares] = useState<number | "">("");
  const [saves, setSaves] = useState<number | "">("");
  const [clicks, setClicks] = useState<number | "">("");
  const [conversions, setConversions] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim()) {
      toast.error("Judul postingan wajib diisi");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/workspace/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          platform,
          postTitle,
          postUrl: postUrl.trim() || null,
          snapshotDate,
          views: Number(views) || 0,
          likes: Number(likes) || 0,
          comments: Number(comments) || 0,
          shares: Number(shares) || 0,
          saves: Number(saves) || 0,
          clicks: clicks !== "" ? Number(clicks) : null,
          conversions: conversions !== "" ? Number(conversions) : null,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error || "Gagal mencatat metrik");
      }

      toast.success("Metrik performa konten berhasil dicatat!");
      onSuccess();
      onClose();
      // Reset
      setPostTitle("");
      setPostUrl("");
      setViews("");
      setLikes("");
      setComments("");
      setShares("");
      setSaves("");
      setClicks("");
      setConversions("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat Metrik Konten Manual</DialogTitle>
          <DialogDescription>
            Masukkan metrik riil dari platform yang Anda publikasikan. Data akan ditandai secara transparan sebagai
            &apos;Input Manual&apos;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="tiktok" className="bg-popover text-popover-foreground">TikTok</option>
                <option value="instagram" className="bg-popover text-popover-foreground">Instagram</option>
                <option value="youtube" className="bg-popover text-popover-foreground">YouTube</option>
                <option value="facebook" className="bg-popover text-popover-foreground">Facebook</option>
                <option value="shopee_video" className="bg-popover text-popover-foreground">Shopee Video</option>
                <option value="other" className="bg-popover text-popover-foreground">Lainnya</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Tanggal Metrik</label>
              <Input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Judul Konten</label>
            <Input
              placeholder="Contoh: 3 Tips Efektif Belajar Coding untuk Pemula"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">URL Postingan (Opsional)</label>
            <Input
              placeholder="https://tiktok.com/@creator/video/1234..."
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Views</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={views}
                onChange={(e) => setViews(e.target.value ? Number(e.target.value) : "")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Likes</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={likes}
                onChange={(e) => setLikes(e.target.value ? Number(e.target.value) : "")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Komentar</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={comments}
                onChange={(e) => setComments(e.target.value ? Number(e.target.value) : "")}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Shares</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={shares}
                onChange={(e) => setShares(e.target.value ? Number(e.target.value) : "")}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Saves / Bookmark</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={saves}
                onChange={(e) => setSaves(e.target.value ? Number(e.target.value) : "")}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Klik Link (Jika Ada)</label>
              <Input
                type="number"
                min="0"
                placeholder="Kosongkan jika tdk ada"
                value={clicks}
                onChange={(e) => setClicks(e.target.value ? Number(e.target.value) : "")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Konversi (Jika Ada)</label>
              <Input
                type="number"
                min="0"
                placeholder="Kosongkan jika tdk ada"
                value={conversions}
                onChange={(e) => setConversions(e.target.value ? Number(e.target.value) : "")}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Metrik</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
