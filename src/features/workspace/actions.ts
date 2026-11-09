"use server";

import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import { setActiveWorkspaceCookie } from "@/lib/security/workspace-cookie";
import {
  createWorkspaceSchema,
  uuidSchema,
  type CreateWorkspaceInput,
} from "@/lib/validation/workspace-schemas";

const ONE_MINUTE_MS = 60 * 1_000;

export async function createWorkspaceAction(input: CreateWorkspaceInput) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false, error: "Sesi tidak valid. Silakan login kembali." };
  }

  const rateLimit = await enforceServerActionRateLimit({
    action: "workspace:create",
    identifier: user.id,
    limit: 10,
    windowMs: ONE_MINUTE_MS,
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Terlalu banyak permintaan pembuatan workspace. Coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
    };
  }

  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Input tidak valid",
    };
  }

  const result = await WorkspaceService.createWorkspace(user.id, parsed.data);
  if (result.success && result.workspace) {
    await setActiveWorkspaceCookie(result.workspace.id);
  }

  return result;
}

export async function switchWorkspaceAction(workspaceId: string) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false, error: "Sesi tidak valid. Silakan login kembali." };
  }

  const rateLimit = await enforceServerActionRateLimit({
    action: "workspace:switch",
    identifier: user.id,
    limit: 30,
    windowMs: ONE_MINUTE_MS,
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: "Terlalu banyak perpindahan workspace dalam waktu singkat.",
    };
  }

  const parsedId = uuidSchema.safeParse(workspaceId);
  if (!parsedId.success) {
    return { success: false, error: "Identitas workspace tidak valid." };
  }

  const hasAccess = await WorkspaceService.verifyWorkspaceAccess(
    user.id,
    parsedId.data,
    "viewer"
  );
  if (!hasAccess) {
    return { success: false, error: "Anda tidak memiliki akses ke workspace tersebut." };
  }

  await setActiveWorkspaceCookie(parsedId.data);
  return { success: true };
}
