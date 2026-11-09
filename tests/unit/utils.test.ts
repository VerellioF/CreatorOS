import { describe, it, expect } from "vitest";
import { cn, formatIDR, slugify } from "@/lib/utils/utils";

describe("Utility Functions Suite", () => {
  it("cn merges Tailwind class names without conflict", () => {
    const result = cn("px-2 py-1", "px-4", { "bg-red-500": true, "text-white": false });
    expect(result).toBe("py-1 px-4 bg-red-500");
  });

  it("formatIDR formats currency correctly into Indonesian Rupiah", () => {
    const formatted = formatIDR(150000);
    // Matches Rp 150.000 or Rp150.000
    expect(formatted.replace(/\s+/g, " ")).toContain("150.000");
  });

  it("slugify turns arbitrary string into clean URL-friendly slug", () => {
    expect(slugify("Creator OS: AI Platform 2026!")).toBe("creator-os-ai-platform-2026");
    expect(slugify("  Belajar  Konten  TikTok ")).toBe("belajar-konten-tiktok");
  });
});
