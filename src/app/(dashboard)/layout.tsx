import * as React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService, type WorkspaceWithRole } from "@/services/workspace-service";
import { ProfileService } from "@/services/profile-service";
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

  // Fetch or create profile & workspaces
  const profile = await ProfileService.getProfile(user.id);
  let workspaces = await WorkspaceService.getWorkspacesForUser(user.id);

  // If user has no workspace, automatically create default personal workspace
  if (workspaces.length === 0) {
    const defaultName = profile?.full_name || user.email?.split("@")[0] || "My Creator";
    const defaultSlug = `${defaultName.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")}-${user.id.slice(0, 5)}`;
    
    await WorkspaceService.createWorkspace(user.id, {
      name: `${defaultName}'s Workspace`,
      slug: defaultSlug,
      creatorMode: "creator",
    });

    workspaces = await WorkspaceService.getWorkspacesForUser(user.id);
  }

  const cookieStore = await cookies();
  const activeWorkspaceCookie = cookieStore.get("active_workspace_id")?.value;
  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceCookie) || workspaces[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspace?.id}
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
