import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ProfileService } from "@/services/profile-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { buildSafeWorkspaceSlug } from "@/lib/security/sanitize";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const profile = await ProfileService.getProfile(user.id);
  let workspaces = await WorkspaceService.getWorkspacesForUser(user.id);

  // Enforce personal owned workspace invariant if user owns zero active workspaces
  const hasOwnedWorkspace = workspaces.some((ws) => ws.role === "owner");
  if (!hasOwnedWorkspace) {
    const defaultName = profile?.full_name || user.email?.split("@")[0] || "My Creator";
    const defaultSlug = buildSafeWorkspaceSlug(defaultName, user.id);

    await WorkspaceService.createWorkspace(user.id, {
      name: `${defaultName}'s Workspace`.slice(0, 50),
      slug: defaultSlug,
      creatorMode: "creator",
    });

    workspaces = await WorkspaceService.getWorkspacesForUser(user.id);
  }

  const activeWorkspaceCookie = await getValidatedActiveWorkspaceId();
  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceCookie) || workspaces[0];

  const creditBalance = currentWorkspace
    ? (
        await UsageBillingService.getWorkspaceCreditBalance(
          currentWorkspace.id,
          user.id
        )
      ).balance
    : 50;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspace?.id}
          creditBalance={creditBalance}
          user={{
            email: user.email,
            fullName: profile?.full_name,
          }}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
