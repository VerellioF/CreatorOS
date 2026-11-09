import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ProductionStudioService } from "@/services/production-studio-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { ImageStudioWorkspace } from "@/features/production-studio/components/image-studio-workspace";

interface ImageStudioPageProps {
  searchParams: Promise<{ prompt?: string; scene?: string }>;
}

export default async function ImageStudioPage({ searchParams }: ImageStudioPageProps) {
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

  const [assets, wallet] = await Promise.all([
    ProductionStudioService.listMediaAssets(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const imageAssets = assets.filter(
    (a) => a.asset_type === "image" || a.asset_type === "thumbnail" || a.asset_type === "brand_visual"
  );

  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  const sceneNum = resolvedParams.scene ? parseInt(resolvedParams.scene, 10) : undefined;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <ImageStudioWorkspace
        workspaceId={currentWorkspace.id}
        initialAssets={imageAssets}
        prefilledPrompt={resolvedParams.prompt}
        prefilledScene={sceneNum}
        canEdit={canEdit}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
