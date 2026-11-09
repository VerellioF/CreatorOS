"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { updateProfileAction, updateWorkspaceSettingsAction } from "@/features/settings/actions";
import { toast } from "sonner";
import { Moon, Sun, Monitor, User, Building, Shield } from "lucide-react";
import type { Profile, Workspace } from "@/lib/supabase/types";

interface SettingsFormProps {
  user: {
    id: string;
    email?: string;
  };
  profile: Profile | null;
  workspace: Workspace | null;
}

export function SettingsForm({ user, profile, workspace }: SettingsFormProps) {
  const { theme, setTheme } = useTheme();

  // Profile Form State
  const [fullName, setFullName] = React.useState(profile?.full_name || "");
  const [preferredLanguage, setPreferredLanguage] = React.useState<"id" | "en">(
    (profile?.preferred_language as "id" | "en") || "id"
  );
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  // Workspace Form State
  const [wsName, setWsName] = React.useState(workspace?.name || "");
  const [creatorMode, setCreatorMode] = React.useState(workspace?.creator_mode || "creator");
  const [defaultAiModel, setDefaultAiModel] = React.useState("gemini-1.5-flash");
  const [isSavingWorkspace, setIsSavingWorkspace] = React.useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = React.useState<"profile" | "workspace" | "appearance">("profile");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await updateProfileAction({
        fullName,
        preferredLanguage,
        themePreference: (theme as "dark" | "light" | "system") || "system",
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
    if (!workspace) return;

    setIsSavingWorkspace(true);
    try {
      const res = await updateWorkspaceSettingsAction(workspace.id, {
        name: wsName,
        creatorMode: creatorMode as "creator" | "affiliate" | "business" | "personal_brand",
        defaultLanguage: preferredLanguage,
        defaultAiModel,
        enableAutoHashtag: true,
        notifyOnPublish: true,
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
      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-border space-x-2">
        <button
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

      {/* Tab: Profile */}
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
                <Input value={user.email || ""} disabled className="bg-muted/40 cursor-not-allowed" />
                <p className="text-[11px] text-muted-foreground mt-1">Email dikelola oleh Supabase Auth.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Nama Lengkap
                </label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap"
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

      {/* Tab: Workspace */}
      {activeTab === "workspace" && (
        <Card>
          <form onSubmit={handleSaveWorkspace}>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Pengaturan Workspace Aktif</CardTitle>
              <CardDescription className="text-xs">
                Konfigurasi nama workspace, Creator Mode, dan model AI default.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Nama Workspace
                </label>
                <Input
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="Nama workspace"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Workspace Slug
                </label>
                <Input value={workspace?.slug || ""} disabled className="bg-muted/40 cursor-not-allowed" />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Creator Mode
                </label>
                <select
                  value={creatorMode}
                  onChange={(e) => setCreatorMode(e.target.value as typeof creatorMode)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="creator">Creator Mode (Audience Growth & Personal)</option>
                  <option value="affiliate">Affiliate Mode (Review & Conversion Scripts)</option>
                  <option value="business">Business Mode (Brand Marketing & Products)</option>
                  <option value="personal_brand">Personal Brand Mode (Expertise & Authority)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">
                  Model AI Default (Fase 2+)
                </label>
                <select
                  value={defaultAiModel}
                  onChange={(e) => setDefaultAiModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="gemini-1.5-flash">Google Gemini 1.5 Flash (Cepat & Hemat Kredit)</option>
                  <option value="gemini-1.5-pro">Google Gemini 1.5 Pro (Penalaran Kompleks)</option>
                  <option value="gpt-4o">OpenAI GPT-4o (Fallback Multi-modal)</option>
                </select>
              </div>
            </CardContent>
            <CardFooter className="border-t border-border pt-4">
              <Button type="submit" size="sm" isLoading={isSavingWorkspace}>
                Simpan Pengaturan Workspace
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Tab: Appearance */}
      {activeTab === "appearance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Tampilan & Tema Visual</CardTitle>
            <CardDescription className="text-xs">
              Pilih preferensi visual interface CreatorOS AI yang nyaman untuk mata Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {/* Light */}
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === "light"
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border bg-card hover:bg-accent text-foreground"
                }`}
              >
                <Sun className="h-6 w-6 mb-2" />
                <span className="text-xs">Mode Terang</span>
              </button>

              {/* Dark */}
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === "dark"
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border bg-card hover:bg-accent text-foreground"
                }`}
              >
                <Moon className="h-6 w-6 mb-2" />
                <span className="text-xs">Mode Gelap</span>
              </button>

              {/* System */}
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  theme === "system"
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-border bg-card hover:bg-accent text-foreground"
                }`}
              >
                <Monitor className="h-6 w-6 mb-2" />
                <span className="text-xs">Ikuti Sistem</span>
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
