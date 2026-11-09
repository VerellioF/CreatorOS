import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface StoredMediaFile {
  id: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  fileSizeBytes: number;
  filename: string;
}

export class MediaStorageService {
  private static getStorageDir(): string {
    const dir = path.join(process.cwd(), ".media-storage");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Persists a binary media buffer to local server storage and returns public streaming URLs.
   */
  static async saveMediaBuffer(
    buffer: Buffer,
    mimeType: string,
    filenameHint: string,
    workspaceId: string
  ): Promise<StoredMediaFile> {
    const storageDir = this.getStorageDir();
    const id = randomUUID();
    const ext = this.getExtensionForMime(mimeType);
    const safeBase = filenameHint.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const filename = `${id}_${safeBase}${ext}`;
    const filePath = path.join(storageDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    // Also write a small metadata JSON companion
    const metaPath = path.join(storageDir, `${id}.meta.json`);
    const metaData = {
      id,
      filename,
      mimeType,
      workspaceId,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(metaPath, JSON.stringify(metaData, null, 2), "utf8");

    const publicUrl = `/api/media/${id}`;

    return {
      id,
      storagePath: filePath,
      publicUrl,
      mimeType,
      fileSizeBytes: buffer.length,
      filename,
    };
  }

  /**
   * Reads media file buffer and metadata by ID.
   */
  static async getMediaFile(id: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    size: number;
    filename: string;
    workspaceId?: string;
  } | null> {
    const storageDir = this.getStorageDir();
    const metaPath = path.join(storageDir, `${id}.meta.json`);

    if (!fs.existsSync(metaPath)) {
      return null;
    }

    try {
      const metaRaw = await fs.promises.readFile(metaPath, "utf8");
      const meta = JSON.parse(metaRaw);
      const filePath = path.join(storageDir, meta.filename);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const buffer = await fs.promises.readFile(filePath);
      return {
        buffer,
        mimeType: meta.mimeType || "application/octet-stream",
        size: meta.size || buffer.length,
        filename: meta.filename,
        workspaceId: meta.workspaceId,
      };
    } catch {
      return null;
    }
  }

  /**
   * Resolves file extension from MIME type.
   */
  private static getExtensionForMime(mime: string): string {
    switch (mime) {
      case "image/png":
        return ".png";
      case "image/jpeg":
      case "image/jpg":
        return ".jpg";
      case "image/webp":
        return ".webp";
      case "image/svg+xml":
        return ".svg";
      case "audio/wav":
      case "audio/x-wav":
        return ".wav";
      case "audio/mpeg":
      case "audio/mp3":
        return ".mp3";
      case "video/mp4":
        return ".mp4";
      case "video/webm":
        return ".webm";
      case "text/vtt":
        return ".vtt";
      case "application/x-subrip":
      case "text/plain":
        return ".srt";
      default:
        return ".bin";
    }
  }
}
