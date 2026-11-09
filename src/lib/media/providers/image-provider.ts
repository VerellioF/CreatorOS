import { GoogleGenAI } from "@google/genai";
import { cleanAndValidateApiKey } from "@/lib/ai/types";
import { generateSynthesizedPng } from "@/lib/media/png-generator";
import type { ImageGenerationRequest } from "@/lib/validation/production-schemas";

export interface GeneratedImageItem {
  buffer: Buffer;
  mimeType: string;
  dimensions: { width: number; height: number };
}

export interface ImageProviderResult {
  images: GeneratedImageItem[];
  provider: string;
}

export interface ImageGenerationProvider {
  readonly id: string;
  isConfigured(): boolean;
  generateImages(request: ImageGenerationRequest): Promise<ImageProviderResult>;
}

export class GoogleImagenProvider implements ImageGenerationProvider {
  readonly id = "google-imagen-3";

  private getApiKey(): string | null {
    return cleanAndValidateApiKey(process.env.GEMINI_API_KEY);
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  async generateImages(request: ImageGenerationRequest): Promise<ImageProviderResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const { width, height } = this.getDimensions(request.aspectRatio);

    try {
      // Call Imagen 3 via Google GenAI SDK
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: `${request.prompt}. Style: ${request.style}. High detail, professional lighting.`,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/png",
          aspectRatio: request.aspectRatio === "9:16" ? "9:16" : request.aspectRatio === "16:9" ? "16:9" : "1:1",
        },
      });

      const base64Bytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64Bytes) {
        return {
          images: [
            {
              buffer: Buffer.from(base64Bytes, "base64"),
              mimeType: "image/png",
              dimensions: { width, height },
            },
          ],
          provider: this.id,
        };
      }
      throw new Error("No image data returned from Imagen model.");
    } catch (err) {
      console.warn("[GoogleImagenProvider] External call failed, falling back to local generative synthesis:", err);
      const fallback = new GenerativeCanvasImageProvider();
      return fallback.generateImages(request);
    }
  }

  private getDimensions(aspectRatio: string): { width: number; height: number } {
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

export class GenerativeCanvasImageProvider implements ImageGenerationProvider {
  readonly id = "generative-canvas-renderer";

  isConfigured(): boolean {
    return true; // Always available standalone
  }

  async generateImages(request: ImageGenerationRequest): Promise<ImageProviderResult> {
    const { width, height } = this.getDimensions(request.aspectRatio);

    let badge = "CREATOR OS";
    if (request.mode === "thumbnail") badge = "THUMBNAIL";
    if (request.mode === "scene_visual") badge = `SCENE ${request.sceneNumber ?? 1}`;
    if (request.mode === "brand_visual") badge = "BRAND VISUAL";
    if (request.mode === "variation") badge = "VARIATION";

    const buffer = generateSynthesizedPng({
      width,
      height,
      title: request.prompt.slice(0, 80),
      style: request.style,
      aspectRatio: request.aspectRatio,
      badge,
    });

    return {
      images: [
        {
          buffer,
          mimeType: "image/png",
          dimensions: { width, height },
        },
      ],
      provider: this.id,
    };
  }

  private getDimensions(aspectRatio: string): { width: number; height: number } {
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

export class ImageProviderRegistry {
  static getProvider(): ImageGenerationProvider {
    const primary = new GoogleImagenProvider();
    if (primary.isConfigured()) {
      return primary;
    }
    return new GenerativeCanvasImageProvider();
  }
}
