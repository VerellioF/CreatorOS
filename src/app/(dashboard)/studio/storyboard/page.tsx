import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ProductionStudioService } from "@/services/production-studio-service";
import { ContentEngineService } from "@/services/content-engine-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { StoryboardStudioWorkspace } from "@/features/production-studio/components/storyboard-studio-workspace";

export default async function StoryboardStudioPage() {
  const user = await AuthService.getCurrentUser();
  if (!user) redirect("/sign-in");

  const [workspaces, activeCookieWsId] = await Promise.all([
    WorkspaceService.getWorkspacesForUser(user.id),
    getValidatedActiveWorkspaceId(),
  ]);

  const currentWorkspace =
    workspaces.find((w) => w.id === activeCookieWsId) ?? workspaces[0];

  if (!currentWorkspace) redirect("/dashboard");

  const [storyboards, packages, wallet] = await Promise.all([
    ProductionStudioService.listStoryboards(currentWorkspace.id, user.id),
    ContentEngineService.listContentPackages(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const scripts = packages.map((pkg) => ({
    id: pkg.id,
    title: pkg.title,
    openingHook: pkg.currentScript?.openingHook || "",
    bodyContent: pkg.currentScript?.bodyContent || "",
    closingCta: pkg.currentScript?.closingCta || "",
  }));

  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <StoryboardStudioWorkspace
        workspaceId={currentWorkspace.id}
        initialStoryboards={storyboards}
        scripts={scripts}
        canEdit={canEdit}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
