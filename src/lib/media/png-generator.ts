import zlib from "node:zlib";

/**
 * Pure Node.js PNG encoder using built-in `node:zlib`.
 * Zero external native C++ dependencies, generates 100% valid W3C PNG files.
 */

// CRC32 Lookup Table
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export interface RenderImageOptions {
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  style: "photorealistic" | "cinematic" | "3d_render" | "minimalist" | "cyberpunk" | "vibrant_creator";
  aspectRatio: string;
  badge?: string;
}

export function generateSynthesizedPng(options: RenderImageOptions): Buffer {
  const { width, height, title, subtitle, style, badge } = options;

  // Determine color themes based on style
  let topR = 30, topG = 27, topB = 75; // deep indigo
  let botR = 15, botG = 23, botB = 42; // deep slate
  let accentR = 99, accentG = 102, accentB = 241; // vibrant indigo

  if (style === "cyberpunk") {
    topR = 15; topG = 5; topB = 30;
    botR = 5; botG = 20; botB = 35;
    accentR = 236; accentG = 72; accentB = 153; // neon pink
  } else if (style === "vibrant_creator") {
    topR = 234; topG = 88; topB = 12; // warm orange
    botR = 147; botG = 51; botB = 234; // purple
    accentR = 250; accentG = 204; accentB = 21; // yellow
  } else if (style === "cinematic") {
    topR = 10; topG = 15; topB = 25;
    botR = 5; botG = 8; botB = 15;
    accentR = 56; accentG = 189; accentB = 248; // cyan
  } else if (style === "minimalist") {
    topR = 245; topG = 245; topB = 250;
    botR = 220; botG = 225; botB = 235;
    accentR = 30; accentG = 41; accentB = 59;
  }

  // Raw RGBA scanlines: width * 4 bytes per row + 1 filter byte (0x00)
  const rowBytes = width * 4 + 1;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter byte: None

    const t = y / height;
    const curR = Math.floor(topR * (1 - t) + botR * t);
    const curG = Math.floor(topG * (1 - t) + botG * t);
    const curB = Math.floor(topB * (1 - t) + botB * t);

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Draw subtle decorative grid / vignette
      const dx = (x - width / 2) / (width / 2);
      const dy = (y - height / 2) / (height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vignette = Math.max(0, 1 - dist * 0.4);

      // Accent border glow at edges
      const isEdge = x < 6 || x > width - 7 || y < 6 || y > height - 7;
      if (isEdge) {
        rawData[pxOffset] = accentR;
        rawData[pxOffset + 1] = accentG;
        rawData[pxOffset + 2] = accentB;
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = Math.min(255, Math.floor(curR * vignette));
        rawData[pxOffset + 1] = Math.min(255, Math.floor(curG * vignette));
        rawData[pxOffset + 2] = Math.min(255, Math.floor(curB * vignette));
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  // Deflate compress raw scanlines
  const compressed = zlib.deflateSync(rawData, { level: 6 });

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // Color type 6: RGBA
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace
  const ihdrChunk = createChunk("IHDR", ihdr);

  // IDAT chunk
  const idatChunk = createChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}
