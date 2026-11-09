import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AdminService } from "@/services/admin-service";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    await AdminService.assertSuperadmin(user.id);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    let query = supabase
      .from("workspaces")
      .select(`
        id,
        name,
        slug,
        creator_mode,
        created_at,
        created_by
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: workspaces, error } = await query;
    if (error) {
      return NextResponse.json({ workspaces: [] });
    }

    return NextResponse.json({ success: true, workspaces: workspaces ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("Hanya Superadmin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    const body = await req.json();
    const { action, workspaceId, amount, reason } = body;

    if (action === "adjust_credits") {
      const result = await AdminService.adjustWorkspaceCredits(
        user.id,
        workspaceId,
        amount,
        reason || "Penyesuaian kredit oleh superadmin"
      );
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("Hanya Superadmin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
