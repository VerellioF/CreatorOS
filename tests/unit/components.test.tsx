import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";

describe("UI Components Suite", () => {
  describe("Button Component", () => {
    it("renders children and handles click event", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Klik Saya</Button>);

      const button = screen.getByRole("button", { name: /klik saya/i });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("disables button and displays loader when isLoading is true", () => {
      render(<Button isLoading>Simpan</Button>);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("EmptyState Component", () => {
    it("renders title, description, and action button", () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          icon={Sparkles}
          title="Tidak Ada Data"
          description="Deskripsi kondisi kosong."
          actionLabel="Buat Baru"
          onAction={handleAction}
        />
      );

      expect(screen.getByText("Tidak Ada Data")).toBeInTheDocument();
      expect(screen.getByText("Deskripsi kondisi kosong.")).toBeInTheDocument();

      const actionBtn = screen.getByRole("button", { name: /buat baru/i });
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });
});
