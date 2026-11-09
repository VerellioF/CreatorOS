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
      .from("profiles")
      .select("id, full_name, avatar_url, preferred_language, onboarding_completed, is_superadmin, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (search) {
      query = query.ilike("full_name", `%${search}%`);
    }

    const { data: users, error } = await query;
    if (error) {
      return NextResponse.json({ users: [] });
    }

    return NextResponse.json({ success: true, users: users ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("Hanya Superadmin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
