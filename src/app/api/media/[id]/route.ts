import { NextRequest, NextResponse } from "next/server";
import { MediaStorageService } from "@/services/media-storage-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    return new NextResponse("Invalid media identifier", { status: 400 });
  }

  const media = await MediaStorageService.getMediaFile(id);

  if (!media) {
    return new NextResponse("Media file not found", { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  const fileSize = media.size;

  if (rangeHeader) {
    // Handle partial range requests (required for Safari/Chrome video & audio scrubbing)
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const chunk = media.buffer.subarray(start, end + 1);

    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Content-Type": media.mimeType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Full response
  return new NextResponse(new Uint8Array(media.buffer), {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Disposition": `inline; filename="${encodeURIComponent(media.filename)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
