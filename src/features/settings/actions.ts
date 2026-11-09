"use server";

import { AuthService } from "@/services/auth-service";
import { ProfileService } from "@/services/profile-service";
import { WorkspaceService } from "@/services/workspace-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validation/auth-schemas";
import {
  updateWorkspaceSettingsSchema,
  uuidSchema,
  type UpdateWorkspaceSettingsInput,
} from "@/lib/validation/workspace-schemas";

const ONE_MINUTE_MS = 60 * 1_000;

export async function updateProfileAction(input: UpdateProfileInput) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false, error: "Sesi tidak valid" };
  }

  const rateLimit = await enforceServerActionRateLimit({
    action: "settings:update-profile",
    identifier: user.id,
    limit: 20,
    windowMs: ONE_MINUTE_MS,
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Terlalu banyak perubahan profil. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
    };
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

  const parsedWorkspaceId = uuidSchema.safeParse(workspaceId);
  if (!parsedWorkspaceId.success) {
    return { success: false, error: "Identitas workspace tidak valid" };
  }

  const rateLimit = await enforceServerActionRateLimit({
    action: "settings:update-workspace",
    identifier: `${user.id}:${parsedWorkspaceId.data}`,
    limit: 20,
    windowMs: ONE_MINUTE_MS,
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Terlalu banyak perubahan pengaturan workspace. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
    };
  }

  const parsed = updateWorkspaceSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  return await WorkspaceService.updateWorkspaceSettings(
    parsedWorkspaceId.data,
    user.id,
    parsed.data
  );
}
