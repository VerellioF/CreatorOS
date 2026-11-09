import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  let isReady = true;

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("system_settings").select("key").limit(1);
    if (error) {
      isReady = false;
    }
  } catch {
    isReady = false;
  }

  if (!isReady) {
    return NextResponse.json(
      { status: "not_ready", reason: "Database connection unreachable", timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { status: "ready", timestamp: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
