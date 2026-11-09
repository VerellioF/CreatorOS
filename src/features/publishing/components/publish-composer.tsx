"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Calendar, Clock, AlertTriangle } from "lucide-react";
import type { PublishingPlatform, SocialAccountRow } from "@/lib/supabase/types";
import type { CreatePublishingJobParams } from "@/services/publishing-service";

export interface PublishComposerProps {
  workspaceId: string;
  userId: string;
  accounts: SocialAccountRow[];
  onSubmitJob: (params: CreatePublishingJobParams) => Promise<void>;
}

export function PublishComposer({
  workspaceId,
  userId,
  accounts,
  onSubmitJob,
}: PublishComposerProps) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<PublishingPlatform>("tiktok");
  const [scheduledDate, setScheduledDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (isScheduled: boolean) => {
    if (!title || !mediaUrl) {
      setError("Judul dan URL media video wajib diisi.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmitJob({
        workspaceId,
        userId,
        contentItemId: `item_${Date.now()}`,
        platform: selectedPlatform,
        title,
        caption,
        mediaUrl,
        aspectRatio: "9:16",
        scheduledFor: isScheduled && scheduledDate ? new Date(scheduledDate).toISOString() : null,
      });

      setTitle("");
      setCaption("");
      setMediaUrl("");
      setScheduledDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menjadwalkan publikasi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const platforms: { id: PublishingPlatform; label: string }[] = [
    { id: "tiktok", label: "TikTok" },
    { id: "instagram", label: "Instagram Reels" },
    { id: "youtube", label: "YouTube Shorts" },
    { id: "facebook", label: "Facebook Reels" },
    { id: "shopee", label: "Shopee Video" },
  ];

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Send className="h-5 w-5 text-indigo-500" />
          Komposer Publikasi & Penjadwalan
        </CardTitle>
        <CardDescription>
          Pilih kanal platform, tentukan caption dan media video untuk dipublikasikan langsung atau dijadwalkan secara otomatis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Target Platform</label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={selectedPlatform === p.id ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setSelectedPlatform(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Judul Konten</label>
          <Input
            placeholder="Judul video untuk hook utama..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Caption & Hashtag</label>
          <Textarea
            placeholder="Tulis caption menarik dan tambahkan tagar relevan (#)..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">URL Media Video (MP4)</label>
          <Input
            placeholder="https://.../video.mp4"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Waktu Penayangan (Opsional)</label>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="text-xs max-w-xs"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-border/50 pt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={isSubmitting || !scheduledDate}
          onClick={() => handleSubmit(true)}
          className="text-xs"
        >
          <Calendar className="h-3.5 w-3.5 mr-1.5" />
          Jadwalkan Penayangan
        </Button>
        <Button
          size="sm"
          disabled={isSubmitting}
          onClick={() => handleSubmit(false)}
          className="text-xs"
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {selectedPlatform === "shopee" ? "Siapkan Ekspor Manual" : "Terbitkan Sekarang"}
        </Button>
      </CardFooter>
    </Card>
  );
}
