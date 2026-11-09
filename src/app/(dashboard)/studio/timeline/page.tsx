import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ProductionStudioService } from "@/services/production-studio-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { TimelineEditorWorkspace } from "@/features/production-studio/components/timeline-editor-workspace";
import { createClient } from "@/lib/supabase/server";
import type { VideoProjectRow } from "@/lib/supabase/types";

interface TimelinePageProps {
  searchParams: Promise<{ projectId?: string }>;
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
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

  const supabase = await createClient();
  let initialProject: VideoProjectRow | null = null;

  if (resolvedParams.projectId) {
    initialProject = await ProductionStudioService.getVideoProject(
      currentWorkspace.id,
      user.id,
      resolvedParams.projectId
    );
  } else {
    // Pick the most recent video project in the workspace if any exists
    const { data } = await supabase
      .from("video_projects")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) initialProject = data as VideoProjectRow;
  }

  const [assets, wallet] = await Promise.all([
    ProductionStudioService.listMediaAssets(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <TimelineEditorWorkspace
        workspaceId={currentWorkspace.id}
        mediaAssets={assets}
        initialProject={initialProject}
        canEdit={canEdit}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
