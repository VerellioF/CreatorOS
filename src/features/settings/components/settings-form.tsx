"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { updateProfileAction, updateWorkspaceSettingsAction } from "@/features/settings/actions";
import { toast } from "sonner";
import { Moon, Sun, Monitor, User, Building } from "lucide-react";
import type { Profile, WorkspaceSettings } from "@/lib/supabase/types";
import type { WorkspaceWithRole } from "@/services/workspace-service";
import {
  normalizeSupportedAiModel,
  type SupportedAiModel,
} from "@/lib/validation/workspace-schemas";

interface SettingsFormProps {
  user: {
    id: string;
    email?: string;
  };
  profile: Profile | null;
  workspace: WorkspaceWithRole | null;
  workspaceSettings: WorkspaceSettings | null;
}

function resolveSupportedModel(raw: string | undefined): SupportedAiModel {
  return normalizeSupportedAiModel(raw);
}

export function SettingsForm({
  user,
  profile,
  workspace,
  workspaceSettings,
}: SettingsFormProps) {
  const { theme, setTheme } = useTheme();

  const canManageWorkspace =
    workspace?.role === "owner" || workspace?.role === "admin";

  // Profile Form State
  const [fullName, setFullName] = React.useState(profile?.full_name || "");
  const [preferredLanguage, setPreferredLanguage] = React.useState<"id" | "en">(
    profile?.preferred_language === "en" ? "en" : "id"
  );
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  // Workspace Form State (hydrated from real DB rows)
  const [wsName, setWsName] = React.useState(workspace?.name || "");
  const [creatorMode, setCreatorMode] = React.useState(
    workspace?.creator_mode || "creator"
  );
  const [wsDefaultLanguage, setWsDefaultLanguage] = React.useState<"id" | "en">(
    workspaceSettings?.default_language === "en" ? "en" : "id"
  );
  const [defaultAiModel, setDefaultAiModel] = React.useState<SupportedAiModel>(
    resolveSupportedModel(workspaceSettings?.default_ai_model)
  );
  const [enableAutoHashtag, setEnableAutoHashtag] = React.useState<boolean>(
    workspaceSettings?.enable_auto_hashtag ?? true
  );
  const [notifyOnPublish, setNotifyOnPublish] = React.useState<boolean>(
    workspaceSettings?.notify_on_publish ?? true
  );
  const [isSavingWorkspace, setIsSavingWorkspace] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState<
    "profile" | "workspace" | "appearance"
  >("profile");

  React.useEffect(() => {
    setWsName(workspace?.name || "");
    setCreatorMode(workspace?.creator_mode || "creator");
    setWsDefaultLanguage(workspaceSettings?.default_language === "en" ? "en" : "id");
    setDefaultAiModel(resolveSupportedModel(workspaceSettings?.default_ai_model));
    setEnableAutoHashtag(workspaceSettings?.enable_auto_hashtag ?? true);
    setNotifyOnPublish(workspaceSettings?.notify_on_publish ?? true);
  }, [workspace, workspaceSettings]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await updateProfileAction({
        fullName,
        preferredLanguage,
        themePreference:
          theme === "dark" || theme === "light" || theme === "system"
            ? theme
            : "system",
      });

      if (res.success) {
        toast.success("Profil berhasil diperbarui!");
      } else {
        toast.error(res.error || "Gagal memperbarui profil");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !canManageWorkspace) return;

    setIsSavingWorkspace(true);
    try {
      const res = await updateWorkspaceSettingsAction(workspace.id, {
        name: wsName,
        creatorMode,
        defaultLanguage: wsDefaultLanguage,
        defaultAiModel,
        enableAutoHashtag,
        notifyOnPublish,
      });

      if (res.success) {
        toast.success("Pengaturan workspace berhasil diperbarui!");
      } else {
        toast.error(res.error || "Gagal memperbarui workspace");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSavingWorkspace(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-border space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Profil Pengguna</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("workspace")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "workspace"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Pengaturan Workspace</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "appearance"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Moon className="h-4 w-4" />
          <span>Tampilan & Tema</span>
        </button>
      </div>

      {activeTab === "profile" && (
        <Card>
          <form onSubmit={handleSaveProfile}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Informasi Profil</CardTitle>
              <CardDescription className="text-xs">
                Perbarui identitas akun dan preferensi bahasa sistem Anda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Email Akun
                </label>
                <Input
                  value={user.email || ""}
                  disabled
                  className="bg-muted/40 cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Email dikelola oleh Supabase Auth.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Nama Lengkap
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
                  maxLength={100}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Bahasa Antarmuka
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value as "id" | "en")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="id">Bahasa Indonesia (Utama)</option>
                  <option value="en">English (Global)</option>
                </select>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border pt-4">
              <Button type="submit" size="sm" isLoading={isSavingProfile}>
                Simpan Perubahan Profil
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {activeTab === "workspace" && (
        <Card>
          <form onSubmit={handleSaveWorkspace}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Pengaturan Workspace Aktif
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Konfigurasi nama workspace, Creator Mode, bahasa konten, dan model AI default.
                  </CardDescription>
                </div>
                {workspace?.role && (
                  <Badge variant="outline" className="uppercase text-[10px]">
                    Peran: {workspace.role}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManageWorkspace && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Hanya pemilik (Owner) atau Admin workspace yang dapat mengubah pengaturan ini.
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Nama Workspace
                </label>
                <Input
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="Nama workspace"
                  maxLength={50}
                  disabled={!canManageWorkspace}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Workspace Slug
                </label>
                <Input
                  value={workspace?.slug || ""}
                  disabled
                  className="bg-muted/40 cursor-not-allowed"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    Creator Mode
                  </label>
                  <select
                    value={creatorMode}
                    disabled={!canManageWorkspace}
                    onChange={(e) => setCreatorMode(e.target.value as typeof creatorMode)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
                  >
                    <option value="creator">Creator Mode (Audience Growth)</option>
                    <option value="affiliate">Affiliate Mode (Review & Conversion)</option>
                    <option value="business">Business Mode (Brand Marketing)</option>
                    <option value="personal_brand">Personal Brand Mode (Authority)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">
                    Bahasa Default Konten
                  </label>
                  <select
                    value={wsDefaultLanguage}
                    disabled={!canManageWorkspace}
                    onChange={(e) => setWsDefaultLanguage(e.target.value as "id" | "en")}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
                  >
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Model AI Default (Fase 2+)
                </label>
                <select
                  value={defaultAiModel}
                  disabled={!canManageWorkspace}
                  onChange={(e) =>
                    setDefaultAiModel(resolveSupportedModel(e.target.value))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
                >
                  <option value="gemini-3.8-flash">
                    Google Gemini 3.8 Flash (Rekomendasi Utama — Cepat & Cerdas)
                  </option>
                  <option value="gemini-3.5-flash-lite">
                    Google Gemini 3.5 Flash-Lite (Ultra Cepat & Hemat Kredit)
                  </option>
                  <option value="gemini-4-argon">
                    Google Gemini 4 Argon (Penalaran Strategis Mendalam)
                  </option>
                  <option value="gpt-4o">OpenAI GPT-4o (Fallback Multi-modal)</option>
                  <option value="gpt-4o-mini">OpenAI GPT-4o Mini (Fallback Efisien)</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAutoHashtag}
                    disabled={!canManageWorkspace}
                    onChange={(e) => setEnableAutoHashtag(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>Aktifkan Rekomendasi Hashtag Otomatis</span>
                </label>

                <label className="flex items-center gap-2.5 rounded-lg border border-border p-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnPublish}
                    disabled={!canManageWorkspace}
                    onChange={(e) => setNotifyOnPublish(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>Notifikasi Jadwal Publikasi</span>
                </label>
              </div>
            </CardContent>
            {canManageWorkspace && (
              <CardFooter className="border-t border-border pt-4">
                <Button type="submit" size="sm" isLoading={isSavingWorkspace}>
                  Simpan Pengaturan Workspace
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>
      )}

      {activeTab === "appearance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Tampilan & Tema Visual
            </CardTitle>
            <CardDescription className="text-xs">
              Pilih preferensi visual interface CreatorOS AI yang nyaman untuk mata Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { id: "light", label: "Mode Terang", Icon: Sun },
                  { id: "dark", label: "Mode Gelap", Icon: Moon },
                  { id: "system", label: "Ikuti Sistem", Icon: Monitor },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    theme === id
                      ? "border-primary bg-primary/5 text-primary font-semibold"
                      : "border-border bg-card hover:bg-accent text-foreground"
                  }`}
                >
                  <Icon className="h-6 w-6 mb-2" />
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
