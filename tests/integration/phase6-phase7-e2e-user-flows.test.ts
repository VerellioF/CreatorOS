import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import { PublishingService } from "@/services/publishing-service";
import { BillingService } from "@/services/billing-service";
import { AnalyticsService } from "@/services/analytics-service";
import { AIAnalystService } from "@/services/ai-analyst-service";
import { SupportService } from "@/services/support-service";
import { CreditService } from "@/services/credit-service";
import type { PerformancePlatform, ContentPerformanceSnapshotRow } from "@/lib/supabase/types";

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn().mockResolvedValue(true),
    getWorkspacesForUser: vi.fn().mockResolvedValue([
      { id: "11111111-1111-1111-1111-111111111111", name: "Creator Studio E2E", role: "owner" },
    ]),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "usr-e2e-tester", email: "creator@creatoros.ai" } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })),
}));

describe("Phase 6 & Phase 7 End-to-End User Journey Workflows", () => {
  const workspaceId = "11111111-1111-1111-1111-111111111111";
  const userId = "usr-e2e-tester";

  beforeEach(() => {
    PublishingService.resetMockData();
    BillingService.resetMockData();
    AnalyticsService.resetMockData();
    AIAnalystService.resetMockData();
    SupportService.resetMockData();
    CreditService.resetMockData();
  });

  describe("1. Publishing Lifecycle & Transparent Social Adapters", () => {
    it("connects social account, schedules content, and generates manual export package", async () => {
      // Step 1: Connect social account (TikTok sandbox)
      const account = await PublishingService.connectSocialAccount({
        workspaceId,
        userId,
        platform: "tiktok",
        accountDetails: {
          accountId: "tt_e2e_001",
          accountName: "@e2e_creator",
          accessToken: "tt_tok_mock_e2e",
        },
      });

      expect(account.platform).toBe("tiktok");
      expect(account.account_name).toBe("@e2e_creator");
      expect(account.status).toBe("connected");

      // Step 2: Create scheduled publishing job
      const scheduledTime = new Date(Date.now() + 86400000).toISOString();
      const job = await PublishingService.createPublishingJob({
        workspaceId,
        userId,
        contentItemId: "ci-e2e-001",
        socialAccountId: account.id,
        platform: "tiktok",
        title: "Video Panduan SaaS #1",
        caption: "Belajar Next.js 15 dan Supabase dari nol! #coding #creator",
        mediaUrl: "https://cdn.creatoros.ai/video1.mp4",
        scheduledFor: scheduledTime,
      });

      expect(job.status).toBe("scheduled");
      expect(job.platform).toBe("tiktok");
      expect(job.workspace_id).toBe(workspaceId);

      // Step 3: Generate manual export package for reliable platform upload
      const exportResult = await PublishingService.prepareManualExport(job.id, workspaceId, userId);
      expect(exportResult.status).toBe("manual_export_ready");
      expect(exportResult.manualExportData.caption).toContain("Belajar Next.js 15");
      expect(exportResult.manualExportData.checklist.length).toBeGreaterThan(0);
      expect(exportResult.manualExportData.platform).toBe("tiktok");
    });
  });

  describe("2. SaaS Monetization & Verified Midtrans Webhook Settlement", () => {
    it("creates checkout, processes verified settlement, and updates workspace subscription", async () => {
      // Step 1: Browse available plans
      const plans = await BillingService.getAvailablePlans();
      const proPlan = plans.find((p) => p.id === "pro");
      expect(proPlan).toBeDefined();
      expect(proPlan?.price_idr).toBe(349000);

      // Step 2: Create checkout
      const checkout = await BillingService.createSubscriptionCheckout({
        workspaceId,
        userId,
        planTier: "pro",
        userEmail: "creator@creatoros.ai",
        userName: "E2E Creator",
      });

      expect(checkout.orderId).toBeTruthy();
      expect(checkout.snapToken).toBeTruthy();
      expect(checkout.redirectUrl).toBeTruthy();

      // Step 3: Generate valid SHA-512 signature for Midtrans settlement notification
      const serverKey = process.env.MIDTRANS_SERVER_KEY || "SB-Mid-server-DEFAULT-MOCK-KEY";
      const signatureKey = crypto
        .createHash("sha512")
        .update(`${checkout.orderId}200349000.00${serverKey}`)
        .digest("hex");

      const webhookPayload = {
        order_id: checkout.orderId,
        status_code: "200",
        gross_amount: "349000.00",
        transaction_status: "settlement",
        payment_type: "qris",
        transaction_id: "trx-midtrans-e2e-001",
        signature_key: signatureKey,
      };

      const webhookResult = await BillingService.handleMidtransWebhook(webhookPayload);

      expect(webhookResult.success).toBe(true);
      expect(webhookResult.action).toBe("activated");

      // Step 4: Verify subscription state
      const sub = await BillingService.getWorkspaceSubscription(workspaceId, userId);
      expect(sub.planTier).toBe("pro");
      expect(sub.status).toBe("active");
    });
  });

  describe("3. Performance Analytics & Traceable AI Diagnostics", () => {
    it("records performance snapshots and synthesizes traceable diagnostics with 0 hallucinations", async () => {
      const analyticsService = new AnalyticsService();
      const analystService = new AIAnalystService();

      // Step 1: Record 2 empirical performance entries across platforms
      const post1 = await analyticsService.recordManualPerformanceEntry(workspaceId, userId, {
        workspaceId,
        platform: "tiktok" as PerformancePlatform,
        postTitle: "5 Rahasia Skalabilitas Database",
        views: 65000,
        likes: 5400,
        comments: 420,
        shares: 890,
        saves: 2100,
        watchTimeSeconds: 32.0,
        retentionRatePct: 71.5,
      });

      const post2 = await analyticsService.recordManualPerformanceEntry(workspaceId, userId, {
        workspaceId,
        platform: "instagram" as PerformancePlatform,
        postTitle: "Setup Workstation Minimalis 2026",
        views: 28000,
        likes: 2200,
        comments: 180,
        shares: 310,
        saves: 850,
      });

      expect(post1.views).toBe(65000);
      expect(post2.views).toBe(28000);

      // Step 2: Overview metrics calculation
      const overview = await analyticsService.getWorkspaceAnalyticsOverview(workspaceId, userId, {
        dateRange: "30d",
      });

      expect(overview.totalViews).toBe(93000);
      expect(overview.totalEngagement).toBe(12350);
      expect(overview.averageEngagementRate).toBeGreaterThan(0);

      // Step 3: Run AI Diagnostics
      const report = await analystService.generateDiagnosticsFromSnapshots(
        workspaceId,
        [post1 as unknown as ContentPerformanceSnapshotRow, post2 as unknown as ContentPerformanceSnapshotRow],
        {
          activePillars: [
            { name: "Tech & Architecture", targetPercentage: 60 },
            { name: "Productivity", targetPercentage: 40 },
          ],
        }
      );

      // Assert zero fake financial sentiment
      expect(report.audienceResponse.sentimentThemes.some((t) => t.includes("keuangan"))).toBe(false);
      expect(report.audienceResponse.sentimentThemes.some((t) => t.includes("investasi"))).toBe(false);
      // Assert sentiment reflects real post titles
      expect(
        report.audienceResponse.sentimentThemes.some((t) => t.includes("5 Rahasia Skalabilitas Database"))
      ).toBe(true);

      // Assert traceable recommendations have evidence tied to real post
      expect(report.recommendations.length).toBeGreaterThan(0);
      const topRec = report.recommendations[0];
      expect(topRec.evidence[0].contentTitle).toBe("5 Rahasia Skalabilitas Database");
      expect(topRec.evidence[0].metricObserved).toContain("65,000 views");
    });
  });

  describe("4. Support Ticket Resolution & SLA Lifecycle", () => {
    it("creates ticket, updates status, and resolves issue cleanly", async () => {
      const supportService = new SupportService();

      // Step 1: Create support ticket
      const ticket = await supportService.createTicket({
        workspaceId,
        userId,
        subject: "Bantuan Integrasi Webhook Midtrans",
        category: "billing",
        priority: "high",
        message: "Perlu konfirmasi status notifikasi IPN Midtrans di production.",
      });

      expect(ticket.status).toBe("open");
      expect(ticket.priority).toBe("high");

      // Step 2: Update status to in_progress
      const updated = await supportService.updateTicketStatus({
        ticketId: ticket.id,
        status: "in_progress",
      });
      expect(updated.status).toBe("in_progress");

      // Step 3: Resolve ticket
      const resolved = await supportService.updateTicketStatus({
        ticketId: ticket.id,
        status: "resolved",
        resolutionNotes: "Signature SHA-512 Midtrans berhasil dikonfigurasi dan diverifikasi.",
      });
      expect(resolved.status).toBe("resolved");
      expect(resolved.resolutionNotes).toContain("Signature SHA-512");
    });
  });
});
