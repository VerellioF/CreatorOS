import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  try {
    const supabase = await createClient();

    // Sign in automatically using the pre-provisioned demo user
    const { error } = await supabase.auth.signInWithPassword({
      email: "demo@creatoros.ai",
      password: "UserDemo",
    });

    if (error) {
      console.error("[Demo Route] Failed to auto-login demo user:", error.message);
      return NextResponse.redirect(new URL("/sign-in?error=demo_unavailable", requestUrl.origin));
    }

    // Redirect directly to dashboard without requiring any user input
    return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
  } catch (err) {
    console.error("[Demo Route] Unexpected error during demo login:", err);
    return NextResponse.redirect(new URL("/sign-in", requestUrl.origin));
  }
}
