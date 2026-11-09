import { z } from "zod";

export const creatorModeEnum = z.enum(["creator", "affiliate", "business", "personal_brand"]);
export type CreatorMode = z.infer<typeof creatorModeEnum>;

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Nama workspace minimal 2 karakter").max(50, "Maksimal 50 karakter"),
  slug: z
    .string()
    .min(3, "Slug minimal 3 karakter")
    .max(50, "Maksimal 50 karakter")
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh berisi huruf kecil, angka, dan strip (-)"),
  creatorMode: creatorModeEnum.default("creator"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSettingsSchema = z.object({
  name: z.string().min(2, "Nama workspace minimal 2 karakter").max(50),
  creatorMode: creatorModeEnum,
  defaultLanguage: z.enum(["id", "en"]).default("id"),
  defaultAiModel: z.string().default("gemini-1.5-flash"),
  enableAutoHashtag: z.boolean().default(true),
  notifyOnPublish: z.boolean().default(true),
});

export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;
