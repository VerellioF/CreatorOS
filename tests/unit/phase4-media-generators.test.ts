import { describe, it, expect } from "vitest";
import { generateSynthesizedPng } from "@/lib/media/png-generator";
import { generateSynthesizedWav } from "@/lib/media/wav-generator";
import { VideoSynthesizer } from "@/lib/media/video-synthesizer";
import { MediaStorageService } from "@/services/media-storage-service";

describe("Phase 4 Unit Tests — Real Media Generators & Storage Engine", () => {
  it("generates a valid binary PNG image buffer with standard chunks (IHDR, IDAT, IEND)", () => {
    const png = generateSynthesizedPng({
      width: 100,
      height: 150,
      title: "Test Image",
      style: "cinematic",
      aspectRatio: "9:16",
      badge: "SCENE 1",
    });

    expect(Buffer.isBuffer(png)).toBe(true);
    expect(png.length).toBeGreaterThan(100);

    // Verify standard W3C PNG 8-byte signature
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) {
      expect(png[i]).toBe(pngSignature[i]);
    }

    // Verify IHDR chunk exists
    expect(png.includes(Buffer.from("IHDR", "ascii"))).toBe(true);
    // Verify IDAT chunk exists
    expect(png.includes(Buffer.from("IDAT", "ascii"))).toBe(true);
    // Verify IEND chunk exists
    expect(png.includes(Buffer.from("IEND", "ascii"))).toBe(true);
  });

  it("generates a valid RIFF/WAVE PCM audio buffer with correct sample rate and duration", () => {
    const wav = generateSynthesizedWav({
      text: "Halo semua, ini adalah contoh naskah voiceover untuk uji coba sintesis suara.",
      language: "id",
      personaId: "budi_energetic",
      speed: 1.0,
      pitch: 1.0,
    });

    expect(Buffer.isBuffer(wav.audioBuffer)).toBe(true);
    expect(wav.mimeType).toBe("audio/wav");
    expect(wav.durationSeconds).toBeGreaterThan(1);
    expect(wav.sampleRate).toBe(24000);

    // Verify RIFF / WAVE header
    const riffTag = wav.audioBuffer.subarray(0, 4).toString("ascii");
    const waveTag = wav.audioBuffer.subarray(8, 12).toString("ascii");
    const fmtTag = wav.audioBuffer.subarray(12, 16).toString("ascii");

    expect(riffTag).toBe("RIFF");
    expect(waveTag).toBe("WAVE");
    expect(fmtTag).toBe("fmt ");
  });

  it("generates a valid ISO-BMFF MP4 video container buffer with ftyp and moov boxes", async () => {
    const clip = await VideoSynthesizer.synthesizeClip({
      title: "Test Scene Clip",
      durationSeconds: 5,
      aspectRatio: "9:16",
    });

    expect(Buffer.isBuffer(clip.videoBuffer)).toBe(true);
    expect(clip.mimeType).toBe("video/mp4");
    expect(clip.durationSeconds).toBe(5);
    expect(clip.width).toBe(1080);
    expect(clip.height).toBe(1920);

    // Check MP4 ftyp box
    expect(clip.videoBuffer.subarray(4, 8).toString("ascii")).toBe("ftyp");
    // Check moov box
    expect(clip.videoBuffer.includes(Buffer.from("moov", "ascii"))).toBe(true);
    // Check mdat box
    expect(clip.videoBuffer.includes(Buffer.from("mdat", "ascii"))).toBe(true);
  });

  it("persists media buffers to storage and reads them with matching metadata and streaming URL", async () => {
    const testData = Buffer.from("Hello CreatorOS Media Engine!");
    const stored = await MediaStorageService.saveMediaBuffer(
      testData,
      "text/plain",
      "test_note",
      "ws-test-123"
    );

    expect(stored.id).toBeDefined();
    expect(stored.publicUrl).toBe(`/api/media/${stored.id}`);
    expect(stored.fileSizeBytes).toBe(testData.length);

    // Read back
    const file = await MediaStorageService.getMediaFile(stored.id);
    expect(file).not.toBeNull();
    expect(file?.buffer.toString("utf8")).toBe("Hello CreatorOS Media Engine!");
    expect(file?.mimeType).toBe("text/plain");
  });
});
