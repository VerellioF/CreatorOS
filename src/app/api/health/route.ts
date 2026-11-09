import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const start = performance.now();
  let dbConnected = false;
  let dbLatency = 0;

  try {
    const supabase = await createClient();
    const dbStart = performance.now();
    const { error } = await supabase.from("system_settings").select("key").limit(1);
    dbLatency = Math.round(performance.now() - dbStart);
    dbConnected = !error;
  } catch {
    dbConnected = false;
  }

  const memory = process.memoryUsage();
  const uptimeSeconds = Math.round(process.uptime());

  const healthData = {
    status: dbConnected ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    version: "0.1.0",
    environment: process.env.NODE_ENV || "development",
    totalResponseTimeMs: Math.round(performance.now() - start),
    database: {
      connected: dbConnected,
      latencyMs: dbLatency,
    },
    system: {
      nodeVersion: process.version,
      rssMemoryMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    },
  };

  return NextResponse.json(healthData, {
    status: dbConnected ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
