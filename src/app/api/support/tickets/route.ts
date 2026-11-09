import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupportService } from "@/services/support-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

const supportService = new SupportService();

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

    const statusParam = (searchParams.get("status") as any) || undefined;
    const tickets = await supportService.getWorkspaceTickets(workspaceId, userId, statusParam);

    return NextResponse.json({ tickets });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/support/tickets", method: "GET" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }
    const userId = user.id;

    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ error: "Parameter workspaceId wajib diisi" }, { status: 400 });
    }

    const ticket = await supportService.createTicket({
      workspaceId,
      userId,
      subject: body.subject,
      category: body.category,
      priority: body.priority || "medium",
      message: body.message,
    });

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/support/tickets", method: "POST" } });
    const message = err instanceof Error ? err.message : "Gagal membuat tiket bantuan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
