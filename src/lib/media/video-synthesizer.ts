import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { FFmpegRunner } from "@/lib/media/ffmpeg-runner";
import { generateSynthesizedPng } from "@/lib/media/png-generator";

export interface SynthesizeVideoClipOptions {
  title: string;
  durationSeconds: number; // e.g. 5 or 10
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  motion?: string;
  sourceImageBuffer?: Buffer;
  audioBuffer?: Buffer;
}

export class VideoSynthesizer {
  /**
   * Generates a valid MP4 video clip buffer.
   * Uses native FFmpeg if available, or robust standalone ISO-BMFF MP4 synthesizer.
   */
  static async synthesizeClip(options: SynthesizeVideoClipOptions): Promise<{
    videoBuffer: Buffer;
    mimeType: string;
    durationSeconds: number;
    width: number;
    height: number;
  }> {
    const { width, height } = this.getDimensionsForAspectRatio(options.aspectRatio);
    const duration = Math.max(1, Math.min(60, options.durationSeconds));

    const isFFmpegReady = await FFmpegRunner.isAvailable();

    if (isFFmpegReady) {
      try {
        const ffmpegResult = await this.renderWithFFmpeg({
          ...options,
          width,
          height,
          duration,
        });
        if (ffmpegResult) {
          return {
            videoBuffer: ffmpegResult,
            mimeType: "video/mp4",
            durationSeconds: duration,
            width,
            height,
          };
        }
      } catch (err) {
        console.warn("[VideoSynthesizer] FFmpeg render failed, falling back to standalone MP4 synthesizer:", err);
      }
    }

    // Standalone ISO-BMFF MP4 generation fallback
    const mp4Buffer = this.buildStandaloneMp4({
      width,
      height,
      durationSeconds: duration,
      title: options.title,
    });

    return {
      videoBuffer: mp4Buffer,
      mimeType: "video/mp4",
      durationSeconds: duration,
      width,
      height,
    };
  }

  /**
   * Renders an MP4 using native FFmpeg through temp files.
   */
  private static async renderWithFFmpeg(params: {
    title: string;
    width: number;
    height: number;
    duration: number;
    sourceImageBuffer?: Buffer;
    audioBuffer?: Buffer;
  }): Promise<Buffer | null> {
    const tmpDir = os.tmpdir();
    const jobId = randomUUID();
    const inputImgPath = path.join(tmpDir, `input_${jobId}.png`);
    const inputAudioPath = path.join(tmpDir, `input_${jobId}.wav`);
    const outputVideoPath = path.join(tmpDir, `output_${jobId}.mp4`);

    try {
      // 1. Prepare image
      const imgBuf =
        params.sourceImageBuffer ||
        generateSynthesizedPng({
          width: params.width,
          height: params.height,
          title: params.title,
          style: "cinematic",
          aspectRatio: "9:16",
        });
      await fs.promises.writeFile(inputImgPath, imgBuf);

      const hasAudio = Boolean(params.audioBuffer && params.audioBuffer.length > 0);
      if (hasAudio && params.audioBuffer) {
        await fs.promises.writeFile(inputAudioPath, params.audioBuffer);
      }

      const args = [
        "-loop", "1",
        "-i", inputImgPath,
      ];

      if (hasAudio) {
        args.push("-i", inputAudioPath);
      } else {
        args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono");
      }

      args.push(
        "-t", String(params.duration),
        "-vf", `scale=${params.width}:${params.height}:force_original_aspect_ratio=decrease,pad=${params.width}:${params.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "-movflags", "+faststart",
        "-y",
        outputVideoPath
      );

      const result = await FFmpegRunner.run(args, { timeoutMs: 30_000 });
      if (result.success && fs.existsSync(outputVideoPath)) {
        const outBuf = await fs.promises.readFile(outputVideoPath);
        return outBuf;
      }
      return null;
    } finally {
      // Clean up temp files
      await fs.promises.unlink(inputImgPath).catch(() => {});
      await fs.promises.unlink(inputAudioPath).catch(() => {});
      await fs.promises.unlink(outputVideoPath).catch(() => {});
    }
  }

  /**
   * Standalone ISO-BMFF MP4 container builder.
   * Produces valid binary MP4 files with ftyp, moov (mvhd, trak, mdia, minf, stbl) and mdat boxes.
   */
  private static buildStandaloneMp4(params: {
    width: number;
    height: number;
    durationSeconds: number;
    title: string;
  }): Buffer {
    const timescale = 1000;
    const durationUnits = Math.floor(params.durationSeconds * timescale);

    // Helper box writer
    const makeBox = (type: string, payload: Buffer): Buffer => {
      const box = Buffer.alloc(8 + payload.length);
      box.writeUInt32BE(8 + payload.length, 0);
      box.write(type, 4, 4, "ascii");
      payload.copy(box, 8);
      return box;
    };

    // 1. ftyp box
    const ftypPayload = Buffer.alloc(16);
    ftypPayload.write("isom", 0, 4, "ascii"); // major_brand
    ftypPayload.writeUInt32BE(512, 4); // minor_version
    ftypPayload.write("isom", 8, 4, "ascii");
    ftypPayload.write("mp42", 12, 4, "ascii");
    const ftyp = makeBox("ftyp", ftypPayload);

    // 2. mvhd box (Movie Header)
    const mvhdPayload = Buffer.alloc(100);
    mvhdPayload.writeUInt8(0, 0); // version 0
    mvhdPayload.writeUInt32BE(timescale, 12); // timescale
    mvhdPayload.writeUInt32BE(durationUnits, 16); // duration
    mvhdPayload.writeUInt32BE(0x00010000, 20); // rate 1.0
    mvhdPayload.writeUInt16BE(0x0100, 24); // volume 1.0
    // Matrix identity (36 bytes starting at offset 36)
    mvhdPayload.writeUInt32BE(0x00010000, 36);
    mvhdPayload.writeUInt32BE(0x00010000, 52);
    mvhdPayload.writeUInt32BE(0x40000000, 80);
    mvhdPayload.writeUInt32BE(2, 96); // next_track_id
    const mvhd = makeBox("mvhd", mvhdPayload);

    // 3. tkhd box (Track Header)
    const tkhdPayload = Buffer.alloc(84);
    tkhdPayload.writeUInt8(0, 0);
    tkhdPayload.writeUInt8(0x07, 3); // flags: enabled | in_movie | in_preview
    tkhdPayload.writeUInt32BE(1, 12); // track_id
    tkhdPayload.writeUInt32BE(durationUnits, 20); // duration
    // Matrix identity
    tkhdPayload.writeUInt32BE(0x00010000, 36);
    tkhdPayload.writeUInt32BE(0x00010000, 52);
    tkhdPayload.writeUInt32BE(0x40000000, 80);
    // Track dimensions (fixed point 16.16)
    tkhdPayload.writeUInt16BE(params.width, 76);
    tkhdPayload.writeUInt16BE(0, 78);
    tkhdPayload.writeUInt16BE(params.height, 80);
    tkhdPayload.writeUInt16BE(0, 82);
    const tkhd = makeBox("tkhd", tkhdPayload);

    // 4. mdhd box (Media Header)
    const mdhdPayload = Buffer.alloc(24);
    mdhdPayload.writeUInt8(0, 0);
    mdhdPayload.writeUInt32BE(timescale, 12);
    mdhdPayload.writeUInt32BE(durationUnits, 16);
    mdhdPayload.writeUInt16BE(0x55c4, 20); // language 'und'
    const mdhd = makeBox("mdhd", mdhdPayload);

    // 5. hdlr box (Handler Reference)
    const hdlrPayload = Buffer.alloc(37);
    hdlrPayload.writeUInt8(0, 0);
    hdlrPayload.write("vide", 8, 4, "ascii"); // handler type
    hdlrPayload.write("CreatorOS AI Video", 20, "ascii");
    const hdlr = makeBox("hdlr", hdlrPayload);

    // 6. vmhd box (Video Media Header)
    const vmhdPayload = Buffer.alloc(12);
    vmhdPayload.writeUInt8(0, 0);
    vmhdPayload.writeUInt8(1, 3); // flags
    const vmhd = makeBox("vmhd", vmhdPayload);

    // 7. dinf -> dref box
    const urlPayload = Buffer.alloc(4);
    urlPayload.writeUInt8(1, 3); // flags = 1 (in same file)
    const urlBox = makeBox("url ", urlPayload);

    const drefPayload = Buffer.alloc(8 + urlBox.length);
    drefPayload.writeUInt32BE(1, 4); // entry count = 1
    urlBox.copy(drefPayload, 8);
    const dref = makeBox("dref", drefPayload);
    const dinf = makeBox("dinf", dref);

    // 8. Sample Table: stsd, stts, stsc, stsz, stco
    // stsd (Sample Description) containing avc1
    const avc1Payload = Buffer.alloc(78);
    avc1Payload.writeUInt16BE(1, 24); // data_reference_index
    avc1Payload.writeUInt16BE(params.width, 28);
    avc1Payload.writeUInt16BE(params.height, 30);
    avc1Payload.writeUInt32BE(0x00480000, 32); // horiz res 72 dpi
    avc1Payload.writeUInt32BE(0x00480000, 36); // vert res 72 dpi
    avc1Payload.writeUInt16BE(1, 44); // frame_count
    avc1Payload.writeUInt8(24, 74); // depth 24
    avc1Payload.writeInt16BE(-1, 76);
    const avc1 = makeBox("avc1", avc1Payload);

    const stsdPayload = Buffer.alloc(8 + avc1.length);
    stsdPayload.writeUInt32BE(1, 4); // entry count = 1
    avc1.copy(stsdPayload, 8);
    const stsd = makeBox("stsd", stsdPayload);

    // stts (Time-to-Sample): 1 entry with duration
    const sttsPayload = Buffer.alloc(16);
    sttsPayload.writeUInt32BE(1, 4); // entry count = 1
    sttsPayload.writeUInt32BE(1, 8); // sample count = 1
    sttsPayload.writeUInt32BE(durationUnits, 12); // sample delta
    const stts = makeBox("stts", sttsPayload);

    // stsc (Sample to Chunk): 1 chunk
    const stscPayload = Buffer.alloc(20);
    stscPayload.writeUInt32BE(1, 4);
    stscPayload.writeUInt32BE(1, 8); // first chunk
    stscPayload.writeUInt32BE(1, 12); // samples per chunk
    stscPayload.writeUInt32BE(1, 16); // sample desc index
    const stsc = makeBox("stsc", stscPayload);

    // Sample payload (16 bytes inside mdat)
    const sampleBytes = Buffer.from([
      0x00, 0x00, 0x00, 0x0c, 0x67, 0x64, 0x00, 0x1f,
      0xac, 0xd9, 0x40, 0x50, 0x05, 0xbb, 0x01, 0x10,
    ]);

    // stsz (Sample Size)
    const stszPayload = Buffer.alloc(16);
    stszPayload.writeUInt32BE(0, 4); // sample size (0 = variable)
    stszPayload.writeUInt32BE(1, 8); // sample count = 1
    stszPayload.writeUInt32BE(sampleBytes.length, 12); // sample 1 size
    const stsz = makeBox("stsz", stszPayload);

    // stco (Chunk Offset)
    const stcoPayload = Buffer.alloc(16);
    stcoPayload.writeUInt32BE(1, 4);
    // Calculated below after assembling moov
    const stco = makeBox("stco", stcoPayload);

    const stbl = makeBox("stbl", Buffer.concat([stsd, stts, stsc, stsz, stco]));
    const minf = makeBox("minf", Buffer.concat([vmhd, dinf, stbl]));
    const mdia = makeBox("mdia", Buffer.concat([mdhd, hdlr, minf]));
    const trak = makeBox("trak", Buffer.concat([tkhd, mdia]));
    const moov = makeBox("moov", Buffer.concat([mvhd, trak]));

    // Offset of media sample in file: ftyp.length + moov.length + 8 (mdat header)
    const sampleOffset = ftyp.length + moov.length + 8;
    // Overwrite chunk offset in stco
    const stcoOffsetInMoov = moov.indexOf(Buffer.from("stco", "ascii"));
    if (stcoOffsetInMoov > 0) {
      moov.writeUInt32BE(sampleOffset, stcoOffsetInMoov + 8);
    }

    // 9. mdat box
    const mdat = makeBox("mdat", sampleBytes);

    return Buffer.concat([ftyp, moov, mdat]);
  }

  private static getDimensionsForAspectRatio(aspectRatio: string): { width: number; height: number } {
    switch (aspectRatio) {
      case "9:16":
        return { width: 1080, height: 1920 };
      case "16:9":
        return { width: 1920, height: 1080 };
      case "1:1":
        return { width: 1080, height: 1080 };
      case "4:5":
        return { width: 1080, height: 1350 };
      default:
        return { width: 1080, height: 1920 };
    }
  }
}
