import * as React from "react";
import { redirect } from "next/navigation";
import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ContentEngineService } from "@/services/content-engine-service";
import { getValidatedActiveWorkspaceId } from "@/lib/security/workspace-cookie";
import { createClient } from "@/lib/supabase/server";
import { ContentCalendarView } from "@/features/calendar/components/content-calendar-view";

export const metadata = {
  title: "Content Calendar — CreatorOS AI",
  description: "Perencanaan jadwal tayang konten, distribusi multi-platform, dan manajemen konsistensi posting.",
};

export default async function CalendarPage() {
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

  const supabase = await createClient();

  const [jobsResult, contentPackages] = await Promise.all([
    supabase
      .from("publishing_jobs")
      .select("id, title, platform, status, scheduled_for, caption")
      .eq("workspace_id", currentWorkspace.id)
      .order("scheduled_for", { ascending: true }),
    ContentEngineService.listContentPackages(currentWorkspace.id, user.id),
  ]);

  const jobs = (jobsResult.data ?? []).map((j: any) => ({
    id: j.id,
    title: j.title,
    platform: j.platform,
    status: j.status,
    scheduled_for: j.scheduled_for,
    caption: j.caption,
  }));

  const packageOptions = contentPackages.map((pkg) => ({
    id: pkg.id,
    title: pkg.title,
    pillarName: pkg.contentFormat || "Format Utama",
  }));

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <ContentCalendarView
        workspaceId={currentWorkspace.id}
        initialJobs={jobs}
        contentPackages={packageOptions}
      />
    </div>
  );
}
