import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ProductionStudioService } from "@/services/production-studio-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { VoiceStudioWorkspace } from "@/features/production-studio/components/voice-studio-workspace";

interface VoiceStudioPageProps {
  searchParams: Promise<{ text?: string; scene?: string }>;
}

export default async function VoiceStudioPage({ searchParams }: VoiceStudioPageProps) {
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
    ProductionStudioService.listMediaAssets(currentWorkspace.id, user.id, "voiceover"),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  const sceneNum = resolvedParams.scene ? parseInt(resolvedParams.scene, 10) : undefined;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <VoiceStudioWorkspace
        workspaceId={currentWorkspace.id}
        initialAssets={assets}
        prefilledText={resolvedParams.text}
        prefilledScene={sceneNum}
        canEdit={canEdit}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
