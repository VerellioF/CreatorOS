import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getAnalytics, POST as postAnalytics } from "@/app/api/workspace/analytics/route";
import { GET as getSingleAnalytics, DELETE as deleteAnalytics } from "@/app/api/workspace/analytics/[id]/route";
import { GET as getDiagnostics, POST as postDiagnostics } from "@/app/api/workspace/analytics/diagnostics/route";
import { AnalyticsService } from "@/services/analytics-service";
import { CreditService, InsufficientCreditsError } from "@/services/credit-service";

vi.mock("@/services/workspace-service", () => ({
  WorkspaceService: {
    verifyWorkspaceAccess: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })),
}));

describe("Phase 7 Analytics API Integration", () => {
  const workspaceId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    AnalyticsService.resetMockData();
  });

  it("POST /api/workspace/analytics records manual performance entry and GET returns overview", async () => {
    // 1. Post a manual entry
    const postPayload = {
      workspaceId,
      platform: "youtube",
      postTitle: "Cara Membangun SaaS dengan Next.js 15",
      postUrl: "https://youtube.com/watch?v=saas-tutorial",
      views: 50000,
      likes: 4200,
      comments: 310,
      shares: 850,
      saves: 1900,
      clicks: 340,
      conversions: 15,
      watchTimeSeconds: 420.5,
    };

    const postReq = new Request("http://localhost/api/workspace/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postPayload),
    });

    const postRes = await postAnalytics(postReq);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.success).toBe(true);
    expect(postJson.item.postTitle).toBe("Cara Membangun SaaS dengan Next.js 15");
    expect(postJson.item.dataSource).toBe("manual_entry");
    expect(postJson.item.clicks).toBe(340);
    expect(postJson.item.conversions).toBe(15);

    // 2. GET overview
    const getReq = new Request(
      `http://localhost/api/workspace/analytics?workspaceId=${workspaceId}&dateRange=30d`
    );
    const getRes = await getAnalytics(getReq);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.totalViews).toBe(50000);
    expect(getJson.totalClicks).toBe(340);
    expect(getJson.totalConversions).toBe(15);
    expect(getJson.dataSourcesSummary.manual).toBe(1);

    // 3. GET single snapshot
    const singleReq = new Request(
      `http://localhost/api/workspace/analytics/${postJson.item.id}?workspaceId=${workspaceId}`
    );
    const singleRes = await getSingleAnalytics(singleReq, {
      params: Promise.resolve({ id: postJson.item.id }),
    });
    expect(singleRes.status).toBe(200);
    const singleJson = await singleRes.json();
    expect(singleJson.id).toBe(postJson.item.id);

    // 4. DELETE snapshot
    const deleteReq = new Request(
      `http://localhost/api/workspace/analytics/${postJson.item.id}?workspaceId=${workspaceId}`,
      { method: "DELETE" }
    );
    const deleteRes = await deleteAnalytics(deleteReq, {
      params: Promise.resolve({ id: postJson.item.id }),
    });
    expect(deleteRes.status).toBe(200);
    const deleteJson = await deleteRes.json();
    expect(deleteJson.success).toBe(true);
  });

  it("POST /api/workspace/analytics rejects request missing workspaceId", async () => {
    const postReq = new Request("http://localhost/api/workspace/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "tiktok",
        postTitle: "Missing Workspace ID",
        views: 100,
        likes: 10,
        comments: 0,
        shares: 0,
        saves: 0,
      }),
    });

    const res = await postAnalytics(postReq);
    expect(res.status).toBe(400);
  });

  it("POST /api/workspace/analytics/diagnostics enforces credit check and returns 402 on insufficient credits", async () => {
    vi.spyOn(CreditService, "deductCredits").mockRejectedValueOnce(
      new InsufficientCreditsError(1, 0)
    );

    const postReq = new Request("http://localhost/api/workspace/analytics/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });

    const res = await postDiagnostics(postReq);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("Saldo kredit tidak mencukupi");
  });
});
