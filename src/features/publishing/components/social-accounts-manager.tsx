"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Share2, CheckCircle2, AlertCircle, Unlink, Plus, Video, Smartphone } from "lucide-react";
import type { SocialAccountRow, PublishingPlatform } from "@/lib/supabase/types";

export interface SocialAccountsManagerProps {
  accounts: SocialAccountRow[];
  onConnect: (platform: PublishingPlatform, accountDetails: { accountId: string; accountName: string }) => Promise<void>;
  onDisconnect: (accountId: string) => Promise<void>;
}

interface PlatformDef {
  id: PublishingPlatform;
  name: string;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline";
  directPublish: boolean;
  manualFallback: boolean;
  description: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: "tiktok",
    name: "TikTok",
    badge: "Sandbox / App Review Pending",
    badgeVariant: "secondary",
    directPublish: true,
    manualFallback: false,
    description: "Integrasi Content Posting API v2 (Sandbox mode). Mendukung verifikasi alur kerja publishing & fallback manual.",
  },
  {
    id: "instagram",
    name: "Instagram",
    badge: "Sandbox / App Review Pending",
    badgeVariant: "secondary",
    directPublish: true,
    manualFallback: false,
    description: "Instagram Graph API v20 (Sandbox mode). Mendukung persiapan Reels & fallback manual.",
  },
  {
    id: "youtube",
    name: "YouTube",
    badge: "Sandbox / App Review Pending",
    badgeVariant: "secondary",
    directPublish: true,
    manualFallback: false,
    description: "Google YouTube Data API v3 (Sandbox mode). Mendukung upload Shorts & verifikasi metadata.",
  },
  {
    id: "facebook",
    name: "Facebook",
    badge: "Sandbox / App Review Pending",
    badgeVariant: "secondary",
    directPublish: true,
    manualFallback: false,
    description: "Meta Pages API (Sandbox mode). Mendukung posting video feed & verifikasi status.",
  },
  {
    id: "shopee",
    name: "Shopee Video",
    badge: "Manual Export Workflow",
    badgeVariant: "outline",
    directPublish: false,
    manualFallback: true,
    description: "Alur kerja ekspor manual terpandu dengan checklist aset & pelacakan URL konfirmasi.",
  },
];

export function SocialAccountsManager({
  accounts,
  onConnect,
  onDisconnect,
}: SocialAccountsManagerProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PublishingPlatform | null>(null);
  const [accountHandle, setAccountHandle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenConnect = (p: PublishingPlatform) => {
    setSelectedPlatform(p);
    setAccountHandle("");
  };

  const handleConfirmConnect = async () => {
    if (!selectedPlatform || !accountHandle) return;
    setIsSubmitting(true);
    try {
      await onConnect(selectedPlatform, {
        accountId: `${selectedPlatform}_${Date.now()}`,
        accountName: accountHandle.startsWith("@") ? accountHandle : `@${accountHandle}`,
      });
      setSelectedPlatform(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Share2 className="h-5 w-5 text-indigo-500" />
          Pusat Akun Sosial
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Hubungkan akun resmi media sosial Anda. Setiap platform menggunakan integrasi API resmi atau alur ekspor manual terverifikasi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => {
          const connected = accounts.find((a) => a.platform === platform.id && a.status === "connected");

          return (
            <Card key={platform.id} className="relative overflow-hidden border border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {platform.id === "shopee" ? (
                      <Smartphone className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Video className="h-5 w-5 text-indigo-500" />
                    )}
                    <CardTitle className="text-base font-medium">{platform.name}</CardTitle>
                  </div>
                  <Badge variant={platform.badgeVariant} className="text-xs">
                    {platform.badge}
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-1">
                  {platform.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {connected ? (
                  <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/50 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span className="font-medium text-foreground truncate">{connected.account_name}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                        Aktif
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      onClick={() => onDisconnect(connected.id)}
                    >
                      <Unlink className="h-3.5 w-3.5 mr-1" />
                      Putuskan Akun
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleOpenConnect(platform.id)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Hubungkan {platform.name}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connect Account Modal */}
      <Dialog open={Boolean(selectedPlatform)} onOpenChange={(open) => !open && setSelectedPlatform(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Hubungkan Akun {PLATFORMS.find((p) => p.id === selectedPlatform)?.name}
            </DialogTitle>
            <DialogDescription>
              Masukkan username atau handle akun kreator Anda untuk menghubungkan akun secara resmi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Username / Handle</label>
              <Input
                placeholder="@username_kamu"
                value={accountHandle}
                onChange={(e) => setAccountHandle(e.target.value)}
              />
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Mode Konfigurasi Staging / Sandbox
              </p>
              <p>
                Akun akan didaftarkan untuk verifikasi workflow & checklist ekspor terpadu. Auto-publishing langsung ke platform publik membutuhkan kredensial OAuth Production resmi.
              </p>
            </div>
            <div className="text-xs text-muted-foreground p-3 rounded-md bg-muted/40 border border-border">
              CreatorOS AI menggunakan API sandbox platform dan tidak pernah menyimpan kata sandi Anda.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedPlatform(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              disabled={!accountHandle || isSubmitting}
              onClick={handleConfirmConnect}
            >
              {isSubmitting ? "Menghubungkan..." : "Hubungkan Akun"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
