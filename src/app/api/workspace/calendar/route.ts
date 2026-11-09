import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceService } from "@/services/workspace-service";
import { PublishingService } from "@/services/publishing-service";
import { ContentEngineService } from "@/services/content-engine-service";
import { ErrorTracker } from "@/lib/monitoring/error-tracker";
import { z } from "zod";

const scheduleCalendarItemSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1, "Judul konten wajib diisi"),
  caption: z.string().optional().default(""),
  platform: z.enum(["tiktok", "instagram", "youtube", "facebook", "shopee"]),
  scheduledFor: z.string().datetime({ message: "Format tanggal dan waktu tidak valid" }),
  contentItemId: z.string().uuid().optional(),
});

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

    await WorkspaceService.verifyWorkspaceAccess(user.id, workspaceId, "viewer");

    // Fetch publishing jobs
    const { data: jobs, error } = await supabase
      .from("publishing_jobs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("scheduled_for", { ascending: true });

    if (error) {
      // In case table is empty or error occurs, return empty list gracefully
      return NextResponse.json({ jobs: [] });
    }

    return NextResponse.json({ jobs: jobs ?? [] });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/calendar", method: "GET" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Otorisasi diperlukan" }, { status: 401 });
    }

    const body = await req.json();
    const validated = scheduleCalendarItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Data jadwal tidak valid", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, title, caption, platform, scheduledFor, contentItemId } = validated.data;
    await WorkspaceService.verifyWorkspaceAccess(user.id, workspaceId, "editor");

    // Jika contentItemId tidak disertakan, buat content item draft otomatis
    let targetContentId = contentItemId;
    if (!targetContentId) {
      const { data: newItem, error: itemErr } = await (supabase
        .from("content_items") as any)
        .insert({
          workspace_id: workspaceId,
          title,
          stage: "ready_to_record",
          primary_platform: platform,
          target_platforms: [platform],
          caption,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (itemErr || !newItem) {
        throw new Error("Gagal membuat item konten jadwal: " + (itemErr?.message || "Unknown error"));
      }
      targetContentId = newItem.id;
    }

    if (!targetContentId) {
      throw new Error("ID item konten tidak valid untuk penjadwalan");
    }

    // Insert publishing job scheduled
    const { data: job, error: jobErr } = await supabase
      .from("publishing_jobs")
      .insert({
        workspace_id: workspaceId,
        content_item_id: targetContentId,
        platform,
        title,
        caption,
        status: "scheduled",
        scheduled_for: scheduledFor,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (jobErr) {
      throw new Error("Gagal menjadwalkan publikasi: " + jobErr.message);
    }

    return NextResponse.json({ success: true, job });
  } catch (err) {
    ErrorTracker.captureException(err, { tags: { route: "/api/workspace/calendar", method: "POST" } });
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
