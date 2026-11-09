"use server";

import { AuthService } from "@/services/auth-service";
import { WorkspaceService } from "@/services/workspace-service";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@/lib/validation/workspace-schemas";

export async function createWorkspaceAction(input: CreateWorkspaceInput) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return { success: false, error: "Sesi tidak valid. Silakan login kembali." };
  }

  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Input tidak valid",
    };
  }

  return await WorkspaceService.createWorkspace(user.id, parsed.data);
}
