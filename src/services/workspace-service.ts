import { createClient } from "@/lib/supabase/server";
import type { Workspace, WorkspaceMember } from "@/lib/supabase/types";
import type { CreateWorkspaceInput, UpdateWorkspaceSettingsInput } from "@/lib/validation/workspace-schemas";

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceMember["role"];
}

interface WorkspaceMemberRow {
  role: WorkspaceMember["role"];
  workspace: Workspace | null;
}

export class WorkspaceService {
  /**
   * Retrieves all workspaces where user is an active member
   */
  static async getWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workspace_members")
      .select(`
        role,
        workspace:workspaces (
          id,
          name,
          slug,
          creator_mode,
          logo_url,
          created_by,
          created_at,
          updated_at,
          deleted_at
        )
      `)
      .eq("user_id", userId);

    if (error || !data) {
      return [];
    }

    const rows = data as unknown as WorkspaceMemberRow[];

    return rows
      .filter((item) => item.workspace !== null)
      .map((item) => ({
        ...(item.workspace as Workspace),
        role: item.role,
      }));
  }

  /**
   * Retrieves a single workspace by ID if the user has access
   */
  static async getWorkspaceById(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceWithRole | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workspace_members")
      .select(`
        role,
        workspace:workspaces (
          id,
          name,
          slug,
          creator_mode,
          logo_url,
          created_by,
          created_at,
          updated_at,
          deleted_at
        )
      `)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as unknown as WorkspaceMemberRow;
    if (!row.workspace) {
      return null;
    }

    return {
      ...row.workspace,
      role: row.role,
    };
  }

  /**
   * Verifies if a user has sufficient role permission for a workspace
   */
  static async verifyWorkspaceAccess(
    userId: string,
    workspaceId: string,
    minimumRole: "owner" | "admin" | "editor" | "viewer" = "viewer"
  ): Promise<boolean> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return false;
    }

    const memberRole = (data as { role: WorkspaceMember["role"] }).role;

    const roleHierarchy: Record<string, number> = {
      viewer: 1,
      member: 1,
      editor: 2,
      admin: 3,
      owner: 4,
    };

    const userLevel = roleHierarchy[memberRole] || 0;
    const requiredLevel = roleHierarchy[minimumRole] || 1;

    return userLevel >= requiredLevel;
  }

  /**
   * Creates a new workspace and sets caller as owner
   */
  static async createWorkspace(
    userId: string,
    input: CreateWorkspaceInput
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    const supabase = await createClient();

    // 1. Create workspace
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        name: input.name,
        slug: input.slug,
        creator_mode: input.creatorMode,
        created_by: userId,
      })
      .select()
      .single();

    if (wsError || !workspace) {
      return { success: false, error: wsError?.message || "Gagal membuat workspace" };
    }

    const createdWorkspace = workspace as Workspace;

    // 2. Add owner membership
    const { error: memberError } = await supabase.from("workspace_members").insert({
      workspace_id: createdWorkspace.id,
      user_id: userId,
      role: "owner",
    });

    if (memberError) {
      return { success: false, error: memberError.message };
    }

    // 3. Create default workspace settings
    await supabase.from("workspace_settings").insert({
      workspace_id: createdWorkspace.id,
      default_language: "id",
      default_ai_model: "gemini-1.5-flash",
    });

    return { success: true, workspace: createdWorkspace };
  }

  /**
   * Updates workspace settings (admin/owner only)
   */
  static async updateWorkspaceSettings(
    workspaceId: string,
    userId: string,
    input: UpdateWorkspaceSettingsInput
  ): Promise<{ success: boolean; error?: string }> {
    const hasAccess = await this.verifyWorkspaceAccess(userId, workspaceId, "admin");
    if (!hasAccess) {
      return { success: false, error: "Tidak memiliki izin untuk mengubah pengaturan workspace" };
    }

    const supabase = await createClient();

    // Update workspace name & creator mode
    const { error: wsError } = await supabase
      .from("workspaces")
      .update({
        name: input.name,
        creator_mode: input.creatorMode,
      })
      .eq("id", workspaceId);

    if (wsError) {
      return { success: false, error: wsError.message };
    }

    // Update settings table
    const { error: settingsError } = await supabase
      .from("workspace_settings")
      .update({
        default_language: input.defaultLanguage,
        default_ai_model: input.defaultAiModel,
        enable_auto_hashtag: input.enableAutoHashtag,
        notify_on_publish: input.notifyOnPublish,
      })
      .eq("workspace_id", workspaceId);

    if (settingsError) {
      return { success: false, error: settingsError.message };
    }

    return { success: true };
  }
}
