import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { AiAssistantChat } from "@/features/ai-assistant/components/ai-assistant-chat";

export const metadata = {
  title: "AI Assistant — CreatorOS AI",
  description: "Konsultasi strategi, evaluasi hook, susun naskah, dan bedah algoritma berbasis Creator DNA.",
};

export default async function AiAssistantPage() {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const [workspaces, activeWorkspaceId] = await Promise.all([
    WorkspaceService.getWorkspacesForUser(user.id),
    getValidatedActiveWorkspaceId(),
  ]);

  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  if (!currentWorkspace) {
    redirect("/dashboard");
  }

  const [creatorContext, creditBalanceResult] = await Promise.all([
    CreatorContextService.getWorkspaceCreatorContext(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const creatorName =
    creatorContext?.creatorDna?.creatorName ||
    user.email?.split("@")[0] ||
    "Kreator";

  const primaryNiche =
    creatorContext?.creatorDna?.primaryNiche ||
    creatorContext?.selectedNiche?.nicheTitle ||
    "Umum";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <AiAssistantChat
        workspaceId={currentWorkspace.id}
        creatorName={creatorName}
        niche={primaryNiche}
        creditBalance={creditBalanceResult.balance}
      />
    </div>
  );
}
