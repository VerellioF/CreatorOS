import { z } from "zod";

export const aiAssistantPersonaSchema = z.enum([
  "strategist",
  "hook_doctor",
  "scriptwriter",
  "algorithm_advisor",
]);

export type AiAssistantPersona = z.infer<typeof aiAssistantPersonaSchema>;

export const aiAssistantMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Pesan tidak boleh kosong").max(2000, "Pesan maksimal 2000 karakter"),
  persona: aiAssistantPersonaSchema.optional(),
  suggestedFollowUps: z.array(z.string()).optional(),
  actionItems: z.array(z.string()).optional(),
  timestamp: z.string().optional(),
});

export type AiAssistantMessage = z.infer<typeof aiAssistantMessageSchema>;

export const aiAssistantRequestSchema = z.object({
  workspaceId: z.string().uuid("workspaceId harus berupa UUID valid"),
  message: z.string().min(1, "Pesan tidak boleh kosong").max(1000, "Pesan maksimal 1000 karakter"),
  persona: aiAssistantPersonaSchema.default("strategist"),
  conversationHistory: z.array(aiAssistantMessageSchema).max(10).optional().default([]),
});

export type AiAssistantRequest = z.input<typeof aiAssistantRequestSchema>;

export const aiAssistantResponseSchema = z.object({
  reply: z.string().describe("Tanggapan lengkap, tajam, dan langsung dapat dieksekusi dalam Bahasa Indonesia"),
  suggestedFollowUps: z.array(z.string()).max(4).describe("2-4 rekomendasi pertanyaan lanjutan yang relevan"),
  actionItems: z.array(z.string()).max(5).describe("Langkah tindakan konkrit yang bisa langsung diaplikasikan kreator"),
  confidenceScore: z.number().min(0).max(1).default(0.95),
});

export type AiAssistantResponse = z.infer<typeof aiAssistantResponseSchema>;
