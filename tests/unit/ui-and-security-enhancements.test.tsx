import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MediaStorageService } from "@/services/media-storage-service";
import { BeginnerGuideCard } from "@/features/creator-intelligence/components/beginner-guide-card";
import { CommandPalette } from "@/components/layout/command-palette";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

describe("Security Defenses — Media Storage Service Path Traversal Immunity", () => {
  it("rejects path traversal attempts with invalid characters or parent traversal sequences", async () => {
    // 1. Directory traversal attempt
    const traversalAttempt1 = await MediaStorageService.getMediaFile("../../../etc/passwd");
    expect(traversalAttempt1).toBeNull();

    // 2. Windows-style directory traversal attempt
    const traversalAttempt2 = await MediaStorageService.getMediaFile("..\\..\\windows\\system32");
    expect(traversalAttempt2).toBeNull();

    // 3. Null byte or special control characters
    const traversalAttempt3 = await MediaStorageService.getMediaFile("safe_id\0evil");
    expect(traversalAttempt3).toBeNull();

    // 4. Overly long identifier attempt
    const traversalAttempt4 = await MediaStorageService.getMediaFile("a".repeat(100));
    expect(traversalAttempt4).toBeNull();

    // 5. Non-existent identifier returns null cleanly without throwing
    const nonExistent = await MediaStorageService.getMediaFile("non-existent-uuid-12345");
    expect(nonExistent).toBeNull();
  });
});

describe("UI/UX & Beginner Experience — BeginnerGuideCard", () => {
  it("renders the beginner quickstart steps with estimated time badges and tips", () => {
    render(
      <BeginnerGuideCard
        hasDna={false}
        hasNiche={false}
        hasPillars={false}
        hasScripts={false}
      />
    );

    expect(screen.getByText("Panduan Kilat Kreator Pemula")).toBeDefined();
    expect(screen.getByText("0/5 Langkah Siap")).toBeDefined();
    expect(screen.getByText("Bangun Creator DNA Anda")).toBeDefined();
    expect(screen.getByText("Pilih & Validasi Niche")).toBeDefined();
    expect(screen.getByText("Rancang 3-5 Pilar Konten")).toBeDefined();
    expect(screen.getByText("Buat Paket Naskah Pertama")).toBeDefined();

    // Tip for step 1 is open by default
    expect(screen.getByText(/Formula Karakter:/i)).toBeDefined();

    // Clicking tip for step 2 switches the tip
    const tipButtons = screen.getAllByTitle("Lihat tips praktis");
    expect(tipButtons.length).toBeGreaterThan(1);
    fireEvent.click(tipButtons[1]);

    expect(screen.getByText(/Kiat Niche:/i)).toBeDefined();
  });

  it("reflects progress accurately when creator has completed steps", () => {
    render(
      <BeginnerGuideCard
        hasDna={true}
        hasNiche={true}
        hasPillars={true}
        hasScripts={false}
      />
    );

    expect(screen.getByText("3/5 Langkah Siap")).toBeDefined();
    expect(screen.getByText("Review DNA")).toBeDefined();
    expect(screen.getByText("Kelola Niche")).toBeDefined();
    expect(screen.getByText("Lihat Pilar")).toBeDefined();
    expect(screen.getByText("Tulis Naskah")).toBeDefined();
  });
});

describe("UI/UX — CommandPalette (⌘K / Quick Navigation)", () => {
  it("renders command items and filters dynamically based on search query", () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByPlaceholderText(/Ketik nama fitur, ide, naskah/i)).toBeDefined();
    expect(screen.getByText("Creator Profile & DNA")).toBeDefined();
    expect(screen.getByText("Script Studio")).toBeDefined();
    expect(screen.getByText("Performance Analytics & AI Diagnostics")).toBeDefined();

    // Type query to filter
    const input = screen.getByPlaceholderText(/Ketik nama fitur, ide, naskah/i);
    fireEvent.change(input, { target: { value: "naskah" } });

    expect(screen.getByText("Script Studio")).toBeDefined();
  });
});

describe("UI/UX — MobileNavDrawer", () => {
  it("renders mobile drawer navigation and responds to close trigger", () => {
    const onOpenChange = vi.fn();
    render(<MobileNavDrawer open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByText("Menu Navigasi")).toBeDefined();
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Script Studio")).toBeDefined();
    expect(screen.getByText("Publishing Center")).toBeDefined();

    const closeButton = screen.getByLabelText("Tutup Menu");
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
