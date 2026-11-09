import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SocialAccountsManager } from "@/features/publishing/components/social-accounts-manager";
import { ManualExportDialog } from "@/features/publishing/components/manual-export-dialog";
import { SubscriptionPlansCard } from "@/features/billing/components/subscription-plans-card";
import { PlanConfigEditor } from "@/features/admin/components/plan-config-editor";
import type { SocialAccountRow, SaasPlanRow } from "@/lib/supabase/types";

describe("Phase 6 UI — Publishing, Billing & Admin Components", () => {
  it("renders SocialAccountsManager with 5 supported platforms and capability badges", () => {
    const handleConnect = vi.fn();
    const handleDisconnect = vi.fn();
    const mockAccounts: SocialAccountRow[] = [
      {
        id: "acc-1",
        workspace_id: "ws-1",
        platform: "tiktok",
        account_name: "@creator_tiktok",
        account_id: "tt_123",
        avatar_url: null,
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        capabilities: { canUpload: true, canSchedule: true, canPublishDirectly: true },
        status: "connected",
        last_error: null,
        connected_by: "usr-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    render(
      <SocialAccountsManager
        accounts={mockAccounts}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
    );

    expect(screen.getByText("Pusat Akun Sosial")).toBeDefined();
    expect(screen.getByText("TikTok")).toBeDefined();
    expect(screen.getByText("Shopee Video")).toBeDefined();
    expect(screen.getByText("@creator_tiktok")).toBeDefined();
  });

  it("renders ManualExportDialog with step-by-step checklist and confirmation input", () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();
    const mockExportData = {
      platform: "shopee" as const,
      title: "Review Mic Wireless 2026",
      caption: "Mic wireless terbaik untuk konten kreator #ShopeeHaul",
      downloadUrl: "https://storage.creatoros.ai/video.mp4",
      checklist: [
        "Download video hasil render",
        "Buka aplikasi Shopee -> menu Shopee Video",
        "Tempel caption dan rekomendasi hashtag produk",
        "Masukkan link konfirmasi video setelah terbit",
      ],
      instructions: ["Unduh file video MP4"],
      recommendedHashtags: ["#ShopeeHaul", "#RacunShopee"],
    };

    render(
      <ManualExportDialog
        isOpen={true}
        jobId="job-123"
        exportData={mockExportData}
        onConfirmPublish={handleConfirm}
        onClose={handleClose}
      />
    );

    expect(screen.getByText("Ekspor Manual Shopee Video")).toBeDefined();
    expect(screen.getByText("Download video hasil render")).toBeDefined();
    expect(screen.getByRole("button", { name: /Download Video/i })).toBeDefined();

    const input = screen.getByPlaceholderText(/https:\/\/id\.shp\.ee\/v\//i);
    fireEvent.change(input, { target: { value: "https://id.shp.ee/v/test123" } });

    const confirmBtn = screen.getByRole("button", { name: /Konfirmasi Publikasi/i });
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledWith("job-123", "https://id.shp.ee/v/test123");
  });

  it("renders SubscriptionPlansCard with Free, Creator, Pro, Business pricing cards", () => {
    const handleSelect = vi.fn();
    const mockPlans: SaasPlanRow[] = [
      {
        id: "free",
        name: "Free Starter",
        price_idr: 0,
        monthly_credits: 50,
        max_workspaces: 1,
        max_members_per_workspace: 1,
        max_storage_mb: 500,
        features: ["basic_ai"],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "creator",
        name: "Creator Pro",
        price_idr: 149000,
        monthly_credits: 500,
        max_workspaces: 3,
        max_members_per_workspace: 3,
        max_storage_mb: 5000,
        features: ["advanced_ai"],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "pro",
        name: "Professional Studio",
        price_idr: 349000,
        monthly_credits: 2000,
        max_workspaces: 10,
        max_members_per_workspace: 10,
        max_storage_mb: 25000,
        features: ["unlimited_agents"],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "business",
        name: "Enterprise / Agency",
        price_idr: 899000,
        monthly_credits: 6000,
        max_workspaces: 50,
        max_members_per_workspace: 50,
        max_storage_mb: 100000,
        features: ["white_label_export"],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    render(
      <SubscriptionPlansCard
        currentPlanTier="free"
        plans={mockPlans}
        onSelectPlan={handleSelect}
      />
    );

    expect(screen.getByText("Free Starter")).toBeDefined();
    expect(screen.getByText("Creator Pro")).toBeDefined();
    expect(screen.getByText("Professional Studio")).toBeDefined();
    expect(screen.getByText("Enterprise / Agency")).toBeDefined();

    const upgradeBtn = screen.getByRole("button", { name: /Pilih Creator Pro|Upgrade/i });
    fireEvent.click(upgradeBtn);
    expect(handleSelect).toHaveBeenCalledWith("creator");
  });

  it("renders PlanConfigEditor allowing admin to update plan prices and credits", () => {
    const handleSave = vi.fn();
    const mockPlans: SaasPlanRow[] = [
      {
        id: "creator",
        name: "Creator Pro",
        price_idr: 149000,
        monthly_credits: 500,
        max_workspaces: 3,
        max_members_per_workspace: 3,
        max_storage_mb: 5000,
        features: ["advanced_ai"],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    render(
      <PlanConfigEditor
        plans={mockPlans}
        onSavePlan={handleSave}
      />
    );

    expect(screen.getByText("Konfigurasi Paket & Harga SaaS")).toBeDefined();
    expect(screen.getByDisplayValue("149000")).toBeDefined();
    expect(screen.getByDisplayValue("500")).toBeDefined();
  });
});
