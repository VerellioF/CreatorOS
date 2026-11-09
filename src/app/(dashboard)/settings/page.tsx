import * as React from "react";
import { cookies } from "next/headers";
import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { WorkspaceService } from "@/services/workspace-service";
import { SettingsForm } from "@/features/settings/components/settings-form";

export default async function SettingsPage() {
  const user = await AuthService.getCurrentUser();
  if (!user) return null;

  const profile = await ProfileService.getProfile(user.id);
  const workspaces = await WorkspaceService.getWorkspacesForUser(user.id);

  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get("active_workspace_id")?.value;
  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Pengaturan Sistem
        </h1>
        <p className="text-sm text-muted-foreground">
          Kelola profil personal, mode kerja workspace, dan preferensi tema.
        </p>
      </div>

      <SettingsForm
        user={{ id: user.id, email: user.email }}
        profile={profile}
        workspace={currentWorkspace}
      />
    </div>
  );
}
