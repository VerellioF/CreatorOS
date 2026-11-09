import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { SubtitleStudioWorkspace } from "@/features/production-studio/components/subtitle-studio-workspace";

interface SubtitleStudioPageProps {
  searchParams: Promise<{ text?: string }>;
}

export default async function SubtitleStudioPage({ searchParams }: SubtitleStudioPageProps) {
  const user = await AuthService.getCurrentUser();
  if (!user) redirect("/sign-in");

  const [resolvedParams, workspaces, activeCookieWsId] = await Promise.all([
    searchParams,
    WorkspaceService.getWorkspacesForUser(user.id),
    getValidatedActiveWorkspaceId(),
  ]);

  const currentWorkspace =
    workspaces.find((w) => w.id === activeCookieWsId) ?? workspaces[0];

  if (!currentWorkspace) redirect("/dashboard");

  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <SubtitleStudioWorkspace
        workspaceId={currentWorkspace.id}
        prefilledText={resolvedParams.text}
        canEdit={canEdit}
      />
    </div>
  );
}
