import type {
  SubtitleCue,
  SubtitleStyling,
} from "@/lib/validation/production-schemas";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 10);
}

function formatSrtTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

function formatVttTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

export class SubtitleGenerator {
  /**
   * Automatically segments a script or transcript into short, dynamic punchy subtitle cues.
   */
  static generateCuesFromText(
    text: string,
    totalDurationSeconds: number = 30
  ): SubtitleCue[] {
    const rawChunks = text
      .replace(/([.?!,])\s+/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If chunks are too long, split further into 4-6 word segments (viral short-video style)
    const segments: string[] = [];
    for (const chunk of rawChunks) {
      const words = chunk.split(/\s+/);
      if (words.length <= 6) {
        segments.push(chunk);
      } else {
        for (let i = 0; i < words.length; i += 5) {
          segments.push(words.slice(i, i + 5).join(" "));
        }
      }
    }

    if (segments.length === 0) {
      return [
        {
          id: generateId(),
          startTimeSeconds: 0,
          endTimeSeconds: Math.max(3, totalDurationSeconds),
          text: "CreatorOS AI Subtitles",
        },
      ];
    }

    const durationPerSegment = Math.max(
      1.2,
      totalDurationSeconds / segments.length
    );

    let currentTime = 0;
    return segments.map((seg, idx) => {
      const start = Number(currentTime.toFixed(2));
      const end = Number((currentTime + durationPerSegment).toFixed(2));
      currentTime += durationPerSegment;

      return {
        id: `cue-${idx + 1}-${generateId().slice(0, 8)}`,
        startTimeSeconds: start,
        endTimeSeconds: end,
        text: seg,
      };
    });
  }

  /**
   * Formats cues into standard SubRip (.srt) format.
   */
  static exportToSrt(cues: SubtitleCue[]): string {
    return cues
      .map((cue, idx) => {
        const start = formatSrtTimestamp(cue.startTimeSeconds);
        const end = formatSrtTimestamp(cue.endTimeSeconds);
        return `${idx + 1}\n${start} --> ${end}\n${cue.text}\n`;
      })
      .join("\n");
  }

  /**
   * Formats cues into standard WebVTT (.vtt) format.
   */
  static exportToVtt(cues: SubtitleCue[]): string {
    const body = cues
      .map((cue) => {
        const start = formatVttTimestamp(cue.startTimeSeconds);
        const end = formatVttTimestamp(cue.endTimeSeconds);
        return `${cue.id}\n${start} --> ${end}\n${cue.text}\n`;
      })
      .join("\n");

    return `WEBVTT\n\n${body}`;
  }

  /**
   * Formats cues & styling into JSON.
   */
  static exportToJson(cues: SubtitleCue[], styling?: SubtitleStyling): string {
    return JSON.stringify(
      {
        version: "1.0",
        styling: styling ?? {},
        cues,
      },
      null,
      2
    );
  }
}
