import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { CreatorContextService } from "@/services/creator-context-service";
import { ResearchService } from "@/services/research-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { getProviderAvailability } from "@/lib/ai/provider-registry";
import { Badge } from "@/components/ui/badge";
import { ResearchWorkspace } from "@/features/research/components/research-workspace";

export default async function TrendResearchPage() {
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

  const [creatorContext, allReports, wallet] = await Promise.all([
    CreatorContextService.getWorkspaceCreatorContext(
      currentWorkspace.id,
      user.id
    ),
    ResearchService.listResearchReports(currentWorkspace.id, user.id),
    UsageBillingService.getWorkspaceCreditBalance(currentWorkspace.id, user.id),
  ]);

  const trendAndAudienceReports = allReports.filter(
    (r) => r.reportType === "trend" || r.reportType === "audience"
  );

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
              Trend & Audience Research
            </h1>
            <Badge variant="outline" className="text-xs">
              {trendAndAudienceReports.length} Dossier Tersimpan
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Riset tren topik dan wawasan audiens berbasis sumber terverifikasi, stempel waktu pengambilan data, serta pemisahan tegas antara fakta dan interpretasi AI.
          </p>
        </div>
      </div>

      <ResearchWorkspace
        context={creatorContext}
        initialReports={trendAndAudienceReports}
        canEdit={canEdit}
        aiConfigured={providerStatus.anyConfigured}
        creditBalance={wallet.balance}
      />
    </div>
  );
}
