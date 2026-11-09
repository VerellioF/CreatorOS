import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { WorkspaceService } from "@/services/workspace-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { SettingsForm } from "@/features/settings/components/settings-form";

export default async function SettingsPage() {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const profile = await ProfileService.getProfile(user.id);
  const workspaces = await WorkspaceService.getWorkspacesForUser(user.id);

  const activeWorkspaceId = await getValidatedActiveWorkspaceId();
  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;

  const workspaceSettings = currentWorkspace
    ? await WorkspaceService.getWorkspaceSettings(currentWorkspace.id, user.id)
    : null;

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
        workspaceSettings={workspaceSettings}
      />
    </div>
  );
}
