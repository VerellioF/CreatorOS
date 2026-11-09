import { describe, it, expect, beforeEach } from "vitest";
import { SupportService } from "@/services/support-service";

describe("Phase 7 User Support Workflow", () => {
  let supportService: SupportService;

  beforeEach(() => {
    SupportService.resetMockData();
    supportService = new SupportService();
  });

  it("creates a support ticket with a unique ticket number and tracks status transitions", async () => {
    const ticket = await supportService.createTicket({
      workspaceId: "11111111-1111-1111-1111-111111111111",
      userId: "user-1",
      subject: "Kendala Pembayaran Paket Creator Pro QRIS",
      category: "billing",
      priority: "high",
      message: "Saya sudah scan QRIS Midtrans namun status paket masih Free Starter.",
    });

    expect(ticket.id).toBeTruthy();
    expect(ticket.ticketNumber).toMatch(/^TICK-\d{4}-[A-Z0-9]{4}$/);
    expect(ticket.status).toBe("open");
    expect(ticket.priority).toBe("high");

    // Retrieve tickets
    const tickets = await supportService.getWorkspaceTickets(
      "11111111-1111-1111-1111-111111111111",
      "user-1"
    );
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe(ticket.id);

    // Update ticket status
    const updated = await supportService.updateTicketStatus({
      ticketId: ticket.id,
      status: "in_progress",
      resolutionNotes: "Sedang diverifikasi dengan log Midtrans.",
      isSuperadmin: true,
    });

    expect(updated.status).toBe("in_progress");
    expect(updated.resolutionNotes).toBe("Sedang diverifikasi dengan log Midtrans.");
  });

  it("rejects ticket creation with empty message or subject", async () => {
    await expect(
      supportService.createTicket({
        workspaceId: "11111111-1111-1111-1111-111111111111",
        userId: "user-1",
        subject: "",
        category: "bug",
        priority: "low",
        message: "",
      })
    ).rejects.toThrow();
  });
});
