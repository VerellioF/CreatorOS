import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { StrategyService } from "@/services/strategy-service";
import { ResearchService } from "@/services/research-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { getProviderAvailability } from "@/lib/ai/provider-registry";
import { Badge } from "@/components/ui/badge";
import { StrategyWorkspace } from "@/features/strategy/components/strategy-workspace";

export default async function ContentStrategyPage() {
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

  const [brandProfile, strategies, researchReports, wallet] = await Promise.all(
    [
      StrategyService.getBrandProfile(currentWorkspace.id, user.id),
      StrategyService.listStrategiesWithPillars(currentWorkspace.id, user.id),
      ResearchService.listResearchReports(currentWorkspace.id, user.id),
      UsageBillingService.getWorkspaceCreditBalance(
        currentWorkspace.id,
        user.id
      ),
    ]
  );

  const activeStrategy =
    strategies.find((s) => s.isActive) ?? strategies[0] ?? null;

  const providerStatus = getProviderAvailability();
  const canEdit =
    currentWorkspace.role === "owner" ||
    currentWorkspace.role === "admin" ||
    currentWorkspace.role === "editor";

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Content Strategy & Pillars
            </h1>
            <Badge
              variant={activeStrategy ? "success" : "secondary"}
              className="text-xs"
            >
              {activeStrategy
                ? `${activeStrategy.pillars.length} Pilar Aktif`
                : "Strategi Belum Dibuat"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola Brand Context, positioning konten, penilaian peluang (opportunity scoring), serta pilar konten yang sepenuhnya dapat disunting.
          </p>
        </div>
      </div>

      <StrategyWorkspace
        workspaceId={currentWorkspace.id}
        workspaceName={currentWorkspace.name}
        initialBrand={brandProfile}
        initialStrategy={activeStrategy}
        researchReports={researchReports}
        canEdit={canEdit}
        aiConfigured={providerStatus.anyConfigured}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
