import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { StrategyService } from "@/services/strategy-service";
import { ResearchService } from "@/services/research-service";
import { ContentEngineService } from "@/services/content-engine-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { getProviderAvailability } from "@/lib/ai/provider-registry";
import { Badge } from "@/components/ui/badge";
import { IdeasWorkspace } from "@/features/content-engine/components/ideas-workspace";

export default async function IdeaGeneratorPage() {
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

  const [ideas, strategies, reports, wallet] = await Promise.all([
    ContentEngineService.listIdeas(currentWorkspace.id, user.id),
    StrategyService.listStrategiesWithPillars(currentWorkspace.id, user.id),
    ResearchService.listResearchReports(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const activeStrategy =
    strategies.find((s) => s.isActive) ?? strategies[0] ?? null;
  const pillars = activeStrategy?.pillars ?? [];

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
              Idea Generator & Content Backlog
            </h1>
            <Badge variant="outline" className="text-xs">
              {ideas.length} Ide Tersimpan
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bangun bank ide konten lintas sudut pandang berdasarkan Creator DNA, pilar strategi, dan temuan riset terverifikasi.
          </p>
        </div>
      </div>

      <IdeasWorkspace
        workspaceId={currentWorkspace.id}
        initialIdeas={ideas}
        pillars={pillars}
        reports={reports}
        canEdit={canEdit}
        aiConfigured={providerStatus.anyConfigured}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
