import * as React from "react";
import { redirect } from "next/navigation";
import { Receipt, Sparkles, Activity, Cpu } from "lucide-react";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function UsageAndCreditsPage() {
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

  const usage = await UsageBillingService.getWorkspaceUsageOverview(
    currentWorkspace.id,
    user.id
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Usage, Token Telemetry & Credits
          </h1>
          <Badge variant="outline" className="text-xs">
            Real-Time Ledger
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Audit penggunaan token AI, estimasi biaya USD provider, dan mutasi kredit pada workspace <strong>{currentWorkspace.name}</strong>.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Saldo Kredit Tersedia
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {usage.balance}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / {usage.monthlyAllowance} kuota bulanan
              </span>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Total Token (10 Eksekusi Terakhir)
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {usage.totalTokensUsedRecent.toLocaleString("id-ID")}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              Estimasi Biaya Provider (10 Terakhir)
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              ${usage.totalCostUsdRecent.toFixed(5)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* AI Provider Usage Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Log Eksekusi AI Provider (`ai_provider_usage`)
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Mencatat model, token input/output, durasi respons, dan biaya setiap operasi AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.recentUsage.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Belum Ada Eksekusi AI Tercatat"
              description="Jalankan wawancara adaptif, sintesis Creator DNA, atau Niche Discovery untuk melihat telemetri penggunaan token secara langsung."
              className="p-6"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3">Operasi</th>
                    <th className="py-2 pr-3">Provider / Model</th>
                    <th className="py-2 pr-3">Token (In/Out/Total)</th>
                    <th className="py-2 pr-3">Biaya USD</th>
                    <th className="py-2 pr-3">Kredit</th>
                    <th className="py-2 pr-3">Durasi</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {usage.recentUsage.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-3 font-medium text-foreground">
                        {row.operation_type}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {row.provider} • <code>{row.model_id}</code>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {row.prompt_tokens} / {row.completion_tokens} /{" "}
                        <strong className="text-foreground">{row.total_tokens}</strong>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        ${Number(row.cost_usd).toFixed(5)}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-foreground">
                        -{row.credits_charged}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {row.duration_ms} ms
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={
                            row.status === "failed" ? "destructive" : "success"
                          }
                          className="text-[10px]"
                        >
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
