"use server";

import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { WorkspaceService } from "@/services/workspace-service";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validation/auth-schemas";
import { updateWorkspaceSettingsSchema, type UpdateWorkspaceSettingsInput } from "@/lib/validation/workspace-schemas";

export async function updateProfileAction(input: UpdateProfileInput) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false, error: "Sesi tidak valid" };
  }

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  return await ProfileService.updateProfile(user.id, parsed.data);
}

export async function updateWorkspaceSettingsAction(
  workspaceId: string,
  input: UpdateWorkspaceSettingsInput
) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false, error: "Sesi tidak valid" };
  }

  const parsed = updateWorkspaceSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  return await WorkspaceService.updateWorkspaceSettings(workspaceId, user.id, parsed.data);
}
