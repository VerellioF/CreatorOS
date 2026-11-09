import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ProductionStudioService } from "@/services/production-studio-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { ExportCenterWorkspace } from "@/features/production-studio/components/export-center-workspace";

export default async function ExportCenterPage() {
  const user = await AuthService.getCurrentUser();
  if (!user) redirect("/sign-in");

  const [workspaces, activeCookieWsId] = await Promise.all([
    WorkspaceService.getWorkspacesForUser(user.id),
    getValidatedActiveWorkspaceId(),
  ]);

  const currentWorkspace =
    workspaces.find((w) => w.id === activeCookieWsId) ?? workspaces[0];

  if (!currentWorkspace) redirect("/dashboard");

  const [allJobs, allAssets, wallet] = await Promise.all([
    ProductionStudioService.listGenerationJobs(currentWorkspace.id, user.id),
    ProductionStudioService.listMediaAssets(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const exportJobs = allJobs.filter((j) => j.job_type === "timeline_export");
  const exportedVideos = allAssets.filter((a) => a.asset_type === "exported_video");

  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <ExportCenterWorkspace
        workspaceId={currentWorkspace.id}
        initialJobs={exportJobs}
        exportedVideos={exportedVideos}
        canEdit={canEdit}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
