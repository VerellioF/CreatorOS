import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { NicheDiscoveryService } from "@/services/niche-discovery-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { getProviderAvailability } from "@/lib/ai/provider-registry";
import { Badge } from "@/components/ui/badge";
import { NicheDiscoveryWorkspace } from "@/features/niche-discovery/components/niche-discovery-workspace";

export default async function NicheDiscoveryPage() {
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

  const [creatorContext, recommendations, wallet] = await Promise.all([
    CreatorContextService.getWorkspaceCreatorContext(
      currentWorkspace.id,
      user.id
    ),
    NicheDiscoveryService.listRecommendations(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const providerStatus = getProviderAvailability();
  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  const selected = recommendations.find((r) => r.isSelected);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Niche Discovery & Market Fit
            </h1>
            <Badge
              variant={selected ? "success" : "secondary"}
              className="text-xs"
            >
              {selected
                ? `Niche Aktif: ${selected.nicheTitle}`
                : "Pilih Niche Utama"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Evaluasi kandidat niche terstruktur berdasarkan profil keahlian, peluang konten, kompetisi kualitatif, dan jalur monetisasi realistis.
          </p>
        </div>
      </div>

      <NicheDiscoveryWorkspace
        context={creatorContext}
        initialRecommendations={recommendations}
        canEdit={canEdit}
        aiConfigured={providerStatus.anyConfigured}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
