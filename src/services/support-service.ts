import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "./workspace-service";
import type {
  SupportTicketRow,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/supabase/types";
import { z } from "zod";

export const createSupportTicketSchema = z.object({
  workspaceId: z.string().uuid("ID workspace tidak valid"),
  userId: z.string().min(1, "ID user wajib ada"),
  subject: z.string().min(3, "Subjek tiket minimal 3 karakter").max(200, "Subjek maksimal 200 karakter"),
  category: z.enum(["billing", "feature_request", "bug", "account", "content", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  message: z.string().min(10, "Pesan kendala minimal 10 karakter"),
});

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export interface SupportTicketItem {
  id: string;
  workspaceId: string;
  userId: string;
  ticketNumber: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  message: string;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export class SupportService {
  private static mockTickets: Map<string, SupportTicketRow[]> = new Map();

  static resetMockData(): void {
    this.mockTickets.clear();
  }

  /**
   * Generates a human-friendly unique ticket number e.g. TICK-2026-X8Y9
   */
  static generateTicketNumber(): string {
    const year = new Date().getFullYear();
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TICK-${year}-${code}`;
  }

  /**
   * Creates a new support ticket
   */
  async createTicket(input: CreateSupportTicketInput): Promise<SupportTicketItem> {
    const validated = createSupportTicketSchema.parse(input);
    const now = new Date().toISOString();
    const ticketNumber = SupportService.generateTicketNumber();

    const newTicket: SupportTicketRow = {
      id: crypto.randomUUID(),
      workspace_id: validated.workspaceId,
      user_id: validated.userId,
      ticket_number: ticketNumber,
      subject: validated.subject,
      category: validated.category,
      priority: validated.priority,
      status: "open",
      message: validated.message,
      resolution_notes: null,
      created_at: now,
      updated_at: now,
    };

    // In-memory cache
    const existing = SupportService.mockTickets.get(validated.workspaceId) || [];
    existing.unshift(newTicket);
    SupportService.mockTickets.set(validated.workspaceId, existing);

    try {
      const supabase = await createClient();
      await supabase.from("support_tickets").insert(newTicket as any);
    } catch {
      // Mock already saved
    }

    return this.formatTicket(newTicket);
  }

  /**
   * Lists tickets for a workspace
   */
  async getWorkspaceTickets(
    workspaceId: string,
    userId: string,
    statusFilter?: SupportTicketStatus
  ): Promise<SupportTicketItem[]> {
    let rows: SupportTicketRow[] = [];

    try {
      const supabase = await createClient();
      let query = supabase
        .from("support_tickets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        rows = data as SupportTicketRow[];
      } else {
        rows = SupportService.mockTickets.get(workspaceId) || [];
      }
    } catch {
      rows = SupportService.mockTickets.get(workspaceId) || [];
    }

    if (statusFilter) {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    return rows.map((r) => this.formatTicket(r));
  }

  /**
   * Updates status and resolution notes of a support ticket
   */
  async updateTicketStatus(params: {
    ticketId: string;
    status: SupportTicketStatus;
    resolutionNotes?: string;
    isSuperadmin?: boolean;
  }): Promise<SupportTicketItem> {
    const now = new Date().toISOString();

    // Look in mock data
    for (const [wsId, tickets] of SupportService.mockTickets.entries()) {
      const idx = tickets.findIndex((t) => t.id === params.ticketId);
      if (idx !== -1) {
        tickets[idx].status = params.status;
        if (params.resolutionNotes) {
          tickets[idx].resolution_notes = params.resolutionNotes;
        }
        tickets[idx].updated_at = now;
        return this.formatTicket(tickets[idx]);
      }
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("support_tickets")
        .update({
          status: params.status,
          resolution_notes: params.resolutionNotes || null,
          updated_at: now,
        })
        .eq("id", params.ticketId)
        .select()
        .single();

      if (!error && data) {
        return this.formatTicket(data as SupportTicketRow);
      }
    } catch {
      // ignore
    }

    throw new Error(`Support ticket not found: ${params.ticketId}`);
  }

  private formatTicket(r: SupportTicketRow): SupportTicketItem {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      userId: r.user_id,
      ticketNumber: r.ticket_number,
      subject: r.subject,
      category: r.category,
      priority: r.priority,
      status: r.status,
      message: r.message,
      resolutionNotes: r.resolution_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
