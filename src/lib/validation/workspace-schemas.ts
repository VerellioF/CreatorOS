import { z } from "zod";
import { isReservedWorkspaceSlug, stripControlChars } from "@/lib/security/sanitize";

export const uuidSchema = z.string().trim().uuid("Identitas resource tidak valid");

export const creatorModeEnum = z.enum(["creator", "affiliate", "business", "personal_brand"]);
export type CreatorMode = z.infer<typeof creatorModeEnum>;

export const supportedAiModelEnum = z.enum([
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-4-argon",
  "gpt-4o",
  "gpt-4o-mini",
]);
export type SupportedAiModel = z.infer<typeof supportedAiModelEnum>;

export function normalizeSupportedAiModel(raw: string | null | undefined): SupportedAiModel {
  if (!raw) return "gemini-3.8-flash";
  if (raw === "gemini-1.5-flash" || raw === "gemini-2.0-flash" || raw === "gemini-2.5-flash") {
    return "gemini-3.8-flash";
  }
  if (raw === "gemini-1.5-pro" || raw === "gemini-2.5-pro") {
    return "gemini-4-argon";
  }
  const parsed = supportedAiModelEnum.safeParse(raw);
  return parsed.success ? parsed.data : "gemini-3.8-flash";
}

export const assignableMemberRoleEnum = z.enum(["admin", "editor", "viewer", "member"]);
export type AssignableMemberRole = z.infer<typeof assignableMemberRoleEnum>;

const workspaceNameField = z
  .string()
  .transform((val) => stripControlChars(val).trim())
  .pipe(
    z
      .string()
      .min(2, "Nama workspace minimal 2 karakter")
      .max(50, "Maksimal 50 karakter")
  );

export const createWorkspaceSchema = z
  .object({
    name: workspaceNameField,
    slug: z
      .string()
      .transform((val) => stripControlChars(val).trim().toLowerCase())
      .pipe(
        z
          .string()
          .min(3, "Slug minimal 3 karakter")
          .max(50, "Maksimal 50 karakter")
          .regex(/^[a-z0-9-]+$/, "Slug hanya boleh berisi huruf kecil, angka, dan strip (-)")
          .refine(
            (slug) => !slug.startsWith("-") && !slug.endsWith("-") && !slug.includes("--"),
            "Slug tidak boleh diawali/diakhiri strip atau memiliki strip ganda"
          )
          .refine(
            (slug) => !isReservedWorkspaceSlug(slug),
            "Slug ini dicadangkan untuk rute sistem"
          )
      ),
    creatorMode: creatorModeEnum.default("creator"),
  })
  .strict();

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSettingsSchema = z
  .object({
    name: workspaceNameField,
    creatorMode: creatorModeEnum,
    defaultLanguage: z.enum(["id", "en"]).default("id"),
    defaultAiModel: supportedAiModelEnum.default("gemini-3.8-flash"),
    enableAutoHashtag: z.boolean().default(true),
    notifyOnPublish: z.boolean().default(true),
  })
  .strict();

export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;

export const addWorkspaceMemberSchema = z
  .object({
    workspaceId: uuidSchema,
    memberUserId: uuidSchema,
    role: assignableMemberRoleEnum.default("member"),
  })
  .strict();

export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;

export const updateWorkspaceMemberRoleSchema = z
  .object({
    workspaceId: uuidSchema,
    memberUserId: uuidSchema,
    newRole: assignableMemberRoleEnum,
  })
  .strict();

export type UpdateWorkspaceMemberRoleInput = z.infer<typeof updateWorkspaceMemberRoleSchema>;

export const removeWorkspaceMemberSchema = z
  .object({
    workspaceId: uuidSchema,
    memberUserId: uuidSchema,
  })
  .strict();

export type RemoveWorkspaceMemberInput = z.infer<typeof removeWorkspaceMemberSchema>;

export const transferWorkspaceOwnershipSchema = z
  .object({
    workspaceId: uuidSchema,
    newOwnerUserId: uuidSchema,
  })
  .strict();

export type TransferWorkspaceOwnershipInput = z.infer<typeof transferWorkspaceOwnershipSchema>;
