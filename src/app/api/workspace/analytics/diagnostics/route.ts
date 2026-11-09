import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIAnalystService } from "@/services/ai-analyst-service";
import { CreditService, InsufficientCreditsError } from "@/services/credit-service";
import { WorkspaceService } from "@/services/workspace-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

const analystService = new AIAnalystService();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "viewer");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak ke workspace ini" }, { status: 403 });
    }

    const report = await analystService.getLatestInsight(workspaceId, userId);
    return NextResponse.json({ insight: report });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/analytics/diagnostics", method: "GET" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const workspaceId = body.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    const hasAccess = await WorkspaceService.verifyWorkspaceAccess(userId, workspaceId, "editor");
    if (!hasAccess) {
      return NextResponse.json({ error: "Akses ditolak: Diperlukan izin editor" }, { status: 403 });
    }

    // Deduct 1 credit for AI diagnostic report; block if insufficient credits
    try {
      await CreditService.deductCredits({
        workspaceId,
        amount: 1,
        description: "AI Content Diagnostics & Traceable Recommendations Report",
        userId,
      });
    } catch (creditErr) {
      if (
        creditErr instanceof InsufficientCreditsError ||
        (creditErr instanceof Error && creditErr.message.toLowerCase().includes("insufficient"))
      ) {
        return NextResponse.json(
          { error: "Saldo kredit tidak mencukupi untuk menjalankan AI Diagnostics." },
          { status: 402 }
        );
      }
      throw creditErr;
    }

    const report = await analystService.diagnoseWorkspacePerformance(workspaceId, userId);

    return NextResponse.json({ success: true, report }, { status: 200 });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/analytics/diagnostics", method: "POST" } });
    const message = err instanceof Error ? err.message : "Gagal menjalankan AI Diagnostics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
