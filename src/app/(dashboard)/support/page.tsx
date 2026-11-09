import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { SupportView } from "@/features/support/components/support-view";

export default async function SupportCenterPage() {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const [workspaces, activeCookieWsId] = await Promise.all([
    WorkspaceService.getWorkspacesForUser(user.id),
    getValidatedActiveWorkspaceId(),
  ]);

  const currentWorkspace =
    workspaces.find((w) => w.id === activeCookieWsId) ?? workspaces[0];

  if (!currentWorkspace) {
    redirect("/dashboard");
  }

  return (
    <SupportView
      workspaceId={currentWorkspace.id}
      userId={user.id}
    />
  );
}
