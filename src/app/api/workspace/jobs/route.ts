import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/auth-service";
import { ProductionStudioService } from "@/services/production-studio-service";

export async function GET(request: NextRequest) {
  const user = await AuthService.getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("wsId");

  if (!workspaceId) {
    return NextResponse.json({ error: "Missing wsId" }, { status: 400 });
  }

  try {
    const jobs = await ProductionStudioService.listGenerationJobs(workspaceId, user.id);
    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
