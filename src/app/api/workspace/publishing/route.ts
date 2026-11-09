import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PublishingService } from "@/services/publishing-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    const [accounts, { data: jobs }] = await Promise.all([
      PublishingService.getConnectedAccounts(workspaceId, userId),
      supabase
        .from("publishing_jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return NextResponse.json({
      accounts: accounts ?? [],
      jobs: jobs ?? [],
    });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/publishing", method: "GET" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    if (body.action === "connect_account") {
      const account = await PublishingService.connectSocialAccount({
        workspaceId: body.workspaceId,
        userId,
        platform: body.platform,
        accountDetails: body.accountDetails,
      });
      return NextResponse.json({ success: true, account });
    }

    if (body.action === "disconnect_account") {
      const ok = await PublishingService.disconnectSocialAccount(
        body.accountId,
        body.workspaceId,
        userId
      );
      return NextResponse.json({ success: ok });
    }

    const job = await PublishingService.createPublishingJob({
      ...body,
      userId,
    });
    return NextResponse.json({ success: true, job });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/publishing", method: "POST" } });
    const message = err instanceof Error ? err.message : "Gagal memproses permintaan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
