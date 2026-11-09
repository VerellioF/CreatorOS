import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/security/sanitize";
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSettings,
} from "@/lib/supabase/types";
import type {
  AssignableMemberRole,
  CreateWorkspaceInput,
  UpdateWorkspaceSettingsInput,
} from "@/lib/validation/workspace-schemas";

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceMember["role"];
}

interface WorkspaceMemberRow {
  role: WorkspaceMember["role"];
  workspace: Workspace | null;
}

function mapWorkspaceRpcError(code: string | undefined, message: string | undefined, fallback: string): string {
  if (code === "23505" || message?.toLowerCase().includes("duplicate key")) {
    return "Slug atau anggota sudah terdaftar pada workspace ini.";
  }
  if (message?.includes("Only workspace owners")) {
    return "Hanya pemilik (owner) workspace yang dapat melakukan tindakan ini.";
  }
  if (message?.includes("Unauthorized") || message?.includes("Privilege violation") || message?.includes("Role escalation")) {
    return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  }
  if (message?.includes("Owner protection violation") || message?.includes("Workspace protection violation")) {
    return "Operasi ditolak demi menjaga kepemilikan aktif workspace.";
  }
  return fallback;
}

async function withSerializationRetry<T>(
  operation: () => Promise<{ data: T | null; error: { code?: string; message?: string } | null }>
): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  const first = await operation();
  if (first.error?.code === "40001") {
    return await operation();
  }
  return first;
}

export class WorkspaceService {
  /**
   * Retrieves all active (non-archived) workspaces where user is a member.
   */
  static async getWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]> {
    if (!isValidUuid(userId)) {
      return [];
    }

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
      .filter((item) => item.workspace !== null && item.workspace.deleted_at === null)
      .map((item) => ({
        ...(item.workspace as Workspace),
        role: item.role,
      }));
  }

  /**
   * Retrieves a single active workspace by ID if the user is a verified member.
   */
  static async getWorkspaceById(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceWithRole | null> {
    if (!isValidUuid(workspaceId) || !isValidUuid(userId)) {
      return null;
    }

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
    if (!row.workspace || row.workspace.deleted_at !== null) {
      return null;
    }

    return {
      ...row.workspace,
      role: row.role,
    };
  }

  /**
   * Retrieves workspace settings scoped to an active workspace the caller can view.
   */
  static async getWorkspaceSettings(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceSettings | null> {
    if (!isValidUuid(workspaceId) || !isValidUuid(userId)) {
      return null;
    }

    const hasAccess = await this.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) {
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("workspace_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as WorkspaceSettings;
  }

  /**
   * Verifies if a user has sufficient role permission for an active workspace.
   */
  static async verifyWorkspaceAccess(
    userId: string,
    workspaceId: string,
    minimumRole: "owner" | "admin" | "editor" | "viewer" = "viewer"
  ): Promise<boolean> {
    if (!isValidUuid(userId) || !isValidUuid(workspaceId)) {
      return false;
    }

    const workspace = await this.getWorkspaceById(workspaceId, userId);
    if (!workspace) {
      return false;
    }

    const roleHierarchy: Record<WorkspaceRole, number> = {
      viewer: 1,
      member: 1,
      editor: 2,
      admin: 3,
      owner: 4,
    };

    const userLevel = roleHierarchy[workspace.role] ?? 0;
    const requiredLevel = roleHierarchy[minimumRole] ?? 1;
    return userLevel >= requiredLevel;
  }

  /**
   * Creates a new workspace (`on_workspace_created` atomically provisions owner & settings).
   */
  static async createWorkspace(
    userId: string,
    input: CreateWorkspaceInput
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    if (!isValidUuid(userId)) {
      return { success: false, error: "Identitas pengguna tidak valid." };
    }

    const supabase = await createClient();
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
      return {
        success: false,
        error: mapWorkspaceRpcError(wsError?.code, wsError?.message, "Gagal membuat workspace baru."),
      };
    }

    return { success: true, workspace: workspace as Workspace };
  }

  /**
   * Atomically updates both `workspaces` and `workspace_settings` via `update_workspace_configuration`.
   */
  static async updateWorkspaceSettings(
    workspaceId: string,
    userId: string,
    input: UpdateWorkspaceSettingsInput
  ): Promise<{ success: boolean; error?: string }> {
    if (!isValidUuid(workspaceId) || !isValidUuid(userId)) {
      return { success: false, error: "Identitas workspace atau pengguna tidak valid." };
    }

    const hasAccess = await this.verifyWorkspaceAccess(userId, workspaceId, "admin");
    if (!hasAccess) {
      return { success: false, error: "Tidak memiliki izin untuk mengubah pengaturan workspace." };
    }

    const supabase = await createClient();
    const { error } = await withSerializationRetry(async () =>
      await supabase.rpc("update_workspace_configuration", {
        target_workspace_id: workspaceId,
        new_name: input.name,
        new_creator_mode: input.creatorMode,
        new_default_language: input.defaultLanguage,
        new_default_ai_model: input.defaultAiModel,
        new_enable_auto_hashtag: input.enableAutoHashtag,
        new_notify_on_publish: input.notifyOnPublish,
      })
    );

    if (error) {
      return {
        success: false,
        error: mapWorkspaceRpcError(error.code, error.message, "Gagal memperbarui pengaturan workspace."),
      };
    }

    return { success: true };
  }

  /**
   * Validated RPC wrappers for membership & lifecycle operations.
   */
  static async addMember(
    workspaceId: string,
    memberUserId: string,
    role: AssignableMemberRole
  ): Promise<{ success: boolean; memberId?: string; error?: string }> {
    const supabase = await createClient();
    const { data, error } = await withSerializationRetry(async () =>
      await supabase.rpc("add_workspace_member", {
        target_workspace_id: workspaceId,
        member_user_id: memberUserId,
        member_role: role,
      })
    );
    if (error || !data) {
      return {
        success: false,
        error: mapWorkspaceRpcError(error?.code, error?.message, "Gagal menambahkan anggota workspace."),
      };
    }
    return { success: true, memberId: data };
  }

  static async updateMemberRole(
    workspaceId: string,
    memberUserId: string,
    newRole: AssignableMemberRole
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { error } = await withSerializationRetry(async () =>
      await supabase.rpc("update_workspace_member_role", {
        target_workspace_id: workspaceId,
        member_user_id: memberUserId,
        new_role: newRole,
      })
    );
    if (error) {
      return {
        success: false,
        error: mapWorkspaceRpcError(error.code, error.message, "Gagal mengubah peran anggota."),
      };
    }
    return { success: true };
  }

  static async removeMember(
    workspaceId: string,
    memberUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { error } = await withSerializationRetry(async () =>
      await supabase.rpc("remove_workspace_member", {
        target_workspace_id: workspaceId,
        member_user_id: memberUserId,
      })
    );
    if (error) {
      return {
        success: false,
        error: mapWorkspaceRpcError(error.code, error.message, "Gagal menghapus anggota workspace."),
      };
    }
    return { success: true };
  }

  static async transferOwnership(
    workspaceId: string,
    newOwnerUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();
    const { error } = await withSerializationRetry(async () =>
      await supabase.rpc("transfer_workspace_ownership", {
        target_workspace_id: workspaceId,
        new_owner_user_id: newOwnerUserId,
      })
    );
    if (error) {
      return {
        success: false,
        error: mapWorkspaceRpcError(error.code, error.message, "Gagal mentransfer kepemilikan workspace."),
      };
    }
    return { success: true };
  }
}
