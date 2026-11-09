import { cleanAndValidateApiKey } from "@/lib/ai/types";
import { generateSynthesizedWav } from "@/lib/media/wav-generator";
import type { VoiceGenerationRequest } from "@/lib/validation/production-schemas";

export interface VoiceProviderResult {
  audioBuffer: Buffer;
  mimeType: string;
  durationSeconds: number;
  provider: string;
}

export interface VoiceGenerationProvider {
  readonly id: string;
  isConfigured(): boolean;
  generateSpeech(request: VoiceGenerationRequest): Promise<VoiceProviderResult>;
}

export class ElevenLabsVoiceProvider implements VoiceGenerationProvider {
  readonly id = "elevenlabs-multilingual-v2";

  private getApiKey(): string | null {
    return cleanAndValidateApiKey(process.env.ELEVENLABS_API_KEY);
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  async generateSpeech(request: VoiceGenerationRequest): Promise<VoiceProviderResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured.");
    }

    try {
      const voiceMap: Record<string, string> = {
        budi_energetic: "ErXwobaYiN019PkySvjV", // Antoni
        siti_warm: "21m00Tcm4TlvDq8ikWAM", // Rachel
        arya_authoritative: "TxGEqnHWrfWFTfGW9XjX", // Josh
        putri_storyteller: "AZnzlk1XvdvUeBnXmlld", // Domi
        rian_casual: "VR6AewLTigWG4xSOukaG", // Arnold
        clara_executive: "EXAVITQu4vr4xnSDxMaL", // Bella
        david_narrator: "onwK4e9ZLuTAKqWW03F9", // Daniel
      };

      const voiceId = voiceMap[request.personaId] || "21m00Tcm4TlvDq8ikWAM";

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: request.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`ElevenLabs API returned status ${res.status}`);
      }

      const arrayBuf = await res.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuf);
      const words = request.text.trim().split(/\s+/).length;
      const durationSeconds = Number(((words / 2.5) / request.speed).toFixed(2));

      return {
        audioBuffer,
        mimeType: "audio/mpeg",
        durationSeconds,
        provider: this.id,
      };
    } catch (err) {
      console.warn("[ElevenLabsVoiceProvider] API call failed, falling back to native synthesizer:", err);
      const fallback = new NativeSynthesisVoiceProvider();
      return fallback.generateSpeech(request);
    }
  }
}

export class NativeSynthesisVoiceProvider implements VoiceGenerationProvider {
  readonly id = "native-pcm-speech-synthesizer";

  isConfigured(): boolean {
    return true; // Always available standalone
  }

  async generateSpeech(request: VoiceGenerationRequest): Promise<VoiceProviderResult> {
    const synthResult = generateSynthesizedWav({
      text: request.text,
      language: request.language,
      personaId: request.personaId,
      speed: request.speed,
      pitch: request.pitch,
    });

    return {
      audioBuffer: synthResult.audioBuffer,
      mimeType: synthResult.mimeType,
      durationSeconds: synthResult.durationSeconds,
      provider: this.id,
    };
  }
}

export class VoiceProviderRegistry {
  static getProvider(): VoiceGenerationProvider {
    const primary = new ElevenLabsVoiceProvider();
    if (primary.isConfigured()) {
      return primary;
    }
    return new NativeSynthesisVoiceProvider();
  }
}
