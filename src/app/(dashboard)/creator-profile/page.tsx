import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { getProviderAvailability } from "@/lib/ai/provider-registry";
import { Badge } from "@/components/ui/badge";
import { CreatorIntelligenceHub } from "@/features/creator-intelligence/components/creator-intelligence-hub";

export default async function CreatorProfilePage() {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const [profile, workspaces, activeCookieWsId] = await Promise.all([
    ProfileService.getProfile(user.id),
    WorkspaceService.getWorkspacesForUser(user.id),
    getValidatedActiveWorkspaceId(),
  ]);

  const currentWorkspace =
    workspaces.find((w) => w.id === activeCookieWsId) ?? workspaces[0];

  if (!currentWorkspace) {
    redirect("/dashboard");
  }

  const [creatorContext, usageOverview] = await Promise.all([
    CreatorContextService.getWorkspaceCreatorContext(
      currentWorkspace.id,
      user.id
    ),
    UsageBillingService.getWorkspaceUsageOverview(currentWorkspace.id, user.id),
  ]);

  const providerStatus = getProviderAvailability();
  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  const activeProviderLabel = providerStatus.geminiConfigured
    ? `Google Gemini (${creatorContext.defaultAiModel})`
    : providerStatus.openaiConfigured
      ? "OpenAI Fallback"
      : "Manual Mode (API Key Belum Diatur)";

  const fallbackName =
    profile?.full_name || user.email?.split("@")[0] || "Creator";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Creator Intelligence & DNA
            </h1>
            <Badge
              variant={creatorContext.creatorDna ? "success" : "secondary"}
              className="text-xs"
            >
              {creatorContext.creatorDna
                ? "Creator DNA Aktif"
                : "Siap Onboarding"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Wawancara onboarding adaptif, Creator DNA yang dapat disunting, persona audiens, evaluasi kesiapan, monetisasi realistis, dan roadmap 30 hari.
          </p>
        </div>
      </div>

      <CreatorIntelligenceHub
        context={creatorContext}
        usage={usageOverview}
        canEdit={canEdit}
        aiConfigured={providerStatus.anyConfigured}
        activeProviderLabel={activeProviderLabel}
        fallbackCreatorName={fallbackName}
      />
    </div>
  );
}
