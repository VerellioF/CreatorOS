import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";

export interface FFmpegRunResult {
  success: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

export class FFmpegRunner {
  private static cachedBinaryPath: string | null = null;
  private static checkedAvailability = false;
  private static isAvailableFlag = false;

  /**
   * Resolves the executable path to FFmpeg.
   */
  static getBinaryPath(): string | null {
    if (this.cachedBinaryPath) return this.cachedBinaryPath;

    // 1. Check environment variable FFMPEG_PATH
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      this.cachedBinaryPath = process.env.FFMPEG_PATH;
      return this.cachedBinaryPath;
    }

    // 2. Check system PATH for `ffmpeg`
    try {
      const probe = spawnSync("ffmpeg", ["-version"], { timeout: 1000, windowsHide: true });
      if (!probe.error && probe.status === 0) {
        this.cachedBinaryPath = "ffmpeg";
        return "ffmpeg";
      }
    } catch {
      // Ignore
    }

    // 3. Check @ffmpeg-installer/ffmpeg
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const installer = require("@ffmpeg-installer/ffmpeg");
      if (installer?.path && fs.existsSync(installer.path)) {
        this.cachedBinaryPath = installer.path;
        return installer.path;
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Fast synchronous check whether FFmpeg can execute successfully on this host OS.
   */
  static isAvailable(): boolean {
    if (this.checkedAvailability) {
      return this.isAvailableFlag;
    }

    const binPath = this.getBinaryPath();
    if (!binPath) {
      this.checkedAvailability = true;
      this.isAvailableFlag = false;
      return false;
    }

    try {
      const res = spawnSync(binPath, ["-version"], { timeout: 1000, windowsHide: true });
      if (res.error || res.status !== 0) {
        this.isAvailableFlag = false;
      } else {
        const out = (res.stdout?.toString() || "").toLowerCase();
        this.isAvailableFlag = out.includes("ffmpeg");
      }
    } catch {
      this.isAvailableFlag = false;
    }

    this.checkedAvailability = true;
    return this.isAvailableFlag;
  }

  /**
   * Runs an FFmpeg command safely.
   */
  static run(
    args: string[],
    options?: { timeoutMs?: number; cwd?: string }
  ): Promise<FFmpegRunResult> {
    const binPath = this.getBinaryPath();
    if (!binPath || !this.isAvailable()) {
      return Promise.resolve({
        success: false,
        code: 1,
        stdout: "",
        stderr: "FFmpeg binary is not runnable on this OS platform.",
      });
    }

    return new Promise((resolve) => {
      const timeoutMs = options?.timeoutMs ?? 30_000;
      let timedOut = false;

      try {
        const child = spawn(binPath, args, {
          windowsHide: true,
          cwd: options?.cwd,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr?.on("data", (chunk) => {
          stderr += chunk.toString();
        });

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs);

        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({
            success: !timedOut && code === 0,
            code: timedOut ? -1 : code,
            stdout,
            stderr: timedOut ? `${stderr}\nFFmpeg execution timed out (${timeoutMs}ms)` : stderr,
          });
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          resolve({
            success: false,
            code: 1,
            stdout,
            stderr: `${stderr}\n${err.message}`,
          });
        });
      } catch (err) {
        resolve({
          success: false,
          code: 1,
          stdout: "",
          stderr: String(err),
        });
      }
    });
  }
}
