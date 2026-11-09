import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiAssistantService } from "@/services/ai-assistant-service";
import { aiAssistantRequestSchema } from "@/lib/validation/ai-assistant-schemas";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    const json = await req.json();
    const validated = aiAssistantRequestSchema.safeParse(json);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Payload tidak valid", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const response = await AiAssistantService.chat(user.id, validated.data);

    return NextResponse.json(response);
  } catch (err) {
    ErrorTracker.captureException(err, {
      tags: { route: "/api/workspace/ai-assistant", method: "POST" },
    });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan sistem";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
