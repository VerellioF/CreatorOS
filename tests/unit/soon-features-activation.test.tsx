import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiAssistantService } from "@/services/ai-assistant-service";
import { ContentCalendarView } from "@/features/calendar/components/content-calendar-view";
import { MonetizationHubView } from "@/features/monetization/components/monetization-hub-view";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn(async () => true),
  },
}));

vi.mock("@/services/creator-context-service", () => ({
  CreatorContextService: {
    getWorkspaceCreatorContext: vi.fn(async () => ({
      workspaceId: "00000000-0000-0000-0000-000000000001",
      creatorDna: {
        creatorName: "Kreator Demo",
        primaryNiche: "Bisnis",
        personalityArchetype: "Eksploratif",
        toneOfVoice: ["Santai", "Informatif"],
        uniqueValueProposition: "Membantu kreator pemula",
        contentStrengths: ["Naskah"],
        primaryPlatforms: ["tiktok"],
        preferredFormats: ["short_video"],
      },
      selectedNiche: {
        nicheTitle: "Bisnis Online",
      },
      audiencePersona: {
        personaName: "Freelancer Muda",
        corePainPoints: ["Bingung mulai", "Takut kamera"],
      },
    })),
  },
}));

vi.mock("@/services/usage-billing-service", () => ({
  UsageBillingService: {
    assertSufficientCredits: vi.fn(async () => true),
  },
}));

describe("Activated Features — AI Assistant, Content Calendar & Monetization Hub", () => {
  it("AiAssistantService generates structured contextual responses with action items and follow-ups", async () => {
    const response = await AiAssistantService.chat("user-123", {
      workspaceId: "00000000-0000-0000-0000-000000000001",
      message: "Bantu saya buat 3 pilar konten utama",
      persona: "strategist",
    });

    expect(response).toBeDefined();
    expect(response.reply).toBeTruthy();
    expect(response.suggestedFollowUps.length).toBeGreaterThan(0);
    expect(response.actionItems.length).toBeGreaterThan(0);
    expect(response.confidenceScore).toBeGreaterThanOrEqual(0.9);
  });

  it("AiAssistantService supports Hook Doctor persona with retention formula", async () => {
    const response = await AiAssistantService.chat("user-123", {
      workspaceId: "00000000-0000-0000-0000-000000000001",
      message: "Perbaiki hook: Halo guys kali ini aku mau share tips",
      persona: "hook_doctor",
    });

    expect(response.reply).toContain("Pattern Interrupt");
    expect(response.actionItems.length).toBeGreaterThan(0);
  });

  it("ContentCalendarView renders interactive month grid, stats cards, and opens scheduling modal", () => {
    render(
      <ContentCalendarView
        workspaceId="00000000-0000-0000-0000-000000000001"
        initialJobs={[
          {
            id: "job-1",
            title: "Tips Produktivitas Remote Work",
            platform: "tiktok",
            status: "scheduled",
            scheduled_for: new Date().toISOString(),
          },
        ]}
        contentPackages={[
          {
            id: "pkg-1",
            title: "Paket Naskah Finansial",
            pillarName: "Edukasi",
          },
        ]}
      />
    );

    // Verify header and stats
    expect(screen.getByText("Content Calendar")).toBeDefined();
    expect(screen.getByText("Total Bulan Ini")).toBeDefined();
    expect(screen.getByText("Terjadwal")).toBeDefined();
    expect(screen.getByText("Naskah Tersedia")).toBeDefined();

    // Verify scheduled item is displayed
    expect(screen.getByText("Tips Produktivitas Remote Work")).toBeDefined();

    // Verify click "Jadwalkan Konten" button opens modal
    const scheduleBtn = screen.getByRole("button", { name: /Jadwalkan Konten/i });
    fireEvent.click(scheduleBtn);

    expect(screen.getByText("Jadwalkan Konten Baru")).toBeDefined();
    expect(screen.getByText("Judul Konten")).toBeDefined();
  });

  it("MonetizationHubView renders rate card calculator and calculates estimated rates dynamically", () => {
    render(
      <MonetizationHubView
        workspaceId="00000000-0000-0000-0000-000000000001"
        creatorName="Budi Santoso"
        primaryNiche="Bisnis"
      />
    );

    expect(screen.getByText("Monetization Hub")).toBeDefined();
    expect(screen.getByText("Kalkulator Estimasi Rate Card")).toBeDefined();
    expect(screen.getByText("Hasil Estimasi Rate")).toBeDefined();
    expect(screen.getByText(/TikTok \/ IG Reels/i)).toBeDefined();
    expect(screen.getByText("Salin Ringkasan Rate Card")).toBeDefined();

    // Switch to Brand Deals tab
    const dealsTab = screen.getByRole("button", { name: /Pipeline Brand Deal/i });
    fireEvent.click(dealsTab);

    expect(screen.getByText("Pipeline Endorsement & Kolaborasi")).toBeDefined();
    expect(screen.getByText("FinTech Nusantara")).toBeDefined();
  });
});
