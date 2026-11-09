import type { SocialPlatformId } from "@/lib/supabase/types";

export interface PlatformRuleSpec {
  id: SocialPlatformId;
  label: string;
  primaryFormat: string;
  aspectRatio: string;
  optimalDurationSeconds: { min: number; max: number; recommended: number };
  hookWindowRule: string;
  maxCaptionLength: number;
  recommendedHashtagCount: { min: number; max: number };
  ctaMechanics: string;
  pacingAndStyleRule: string;
}

export const PLATFORM_RULES: Record<SocialPlatformId, PlatformRuleSpec> = {
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    primaryFormat: "Short-Form Vertical Video",
    aspectRatio: "9:16",
    optimalDurationSeconds: { min: 20, max: 90, recommended: 45 },
    hookWindowRule:
      "2-3 detik pertama wajib memuat kontras visual/teks di layar dan kalimat pembuka langsung ke masalah spesifik tanpa salam basa-basi.",
    maxCaptionLength: 2200,
    recommendedHashtagCount: { min: 3, max: 6 },
    ctaMechanics:
      "Dorong simpan (save), komentar kata kunci pendek, atau cek tautan bio/keranjang kuning secara kontekstual.",
    pacingAndStyleRule:
      "Kalimat lisan pendek (8-14 kata per napas), pergantian sudut pandang/visual tiap 3-5 detik, bahasa percakapan alami.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram Reels & Carousel",
    primaryFormat: "Reels 9:16 / Carousel 4:5",
    aspectRatio: "9:16 atau 4:5",
    optimalDurationSeconds: { min: 15, max: 75, recommended: 40 },
    hookWindowRule:
      "Headline visual bersih yang mudah dipindai dan memicu rasa ingin tahu atau nilai simpan (saveable reference).",
    maxCaptionLength: 2200,
    recommendedHashtagCount: { min: 3, max: 8 },
    ctaMechanics:
      "Fokus pada Save untuk referensi ulang, Share ke Story/teman relevan, atau komentar diskusi (hindari URL mentah di caption karena tidak bisa diklik).",
    pacingAndStyleRule:
      "Estetika rapi, struktur poin bernomor jelas, caption terformat dengan jeda baris (line breaks) yang nyaman dibaca.",
  },
  youtube: {
    id: "youtube",
    label: "YouTube (Shorts & Long-Form)",
    primaryFormat: "YouTube Video / Shorts",
    aspectRatio: "16:9 (Long) atau 9:16 (Shorts)",
    optimalDurationSeconds: { min: 45, max: 600, recommended: 180 },
    hookWindowRule:
      "Validasi janji judul dalam 5-10 detik pertama (proof of value) dan jelaskan peta pembahasan singkat agar retensi terjaga.",
    maxCaptionLength: 4000,
    recommendedHashtagCount: { min: 3, max: 5 },
    ctaMechanics:
      "Arahkan penonton ke video terkait, komentar pengalaman mendalam, atau deskripsi/pinned comment untuk sumber lanjutan.",
    pacingAndStyleRule:
      "Penjelasan mendalam berlapis contoh konkret, transisi antar-bagian tegas, kesimpulan praktis yang tuntas.",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    primaryFormat: "Thought Leadership Post / Document Carousel",
    aspectRatio: "4:5 (Dokumen PDF) atau Teks Naratif",
    optimalDurationSeconds: { min: 30, max: 120, recommended: 60 },
    hookWindowRule:
      "2 baris pertama sebelum tombol 'lihat selengkapnya' wajib memuat observasi tajam, studi kasus nyata, atau pelajaran profesional.",
    maxCaptionLength: 3000,
    recommendedHashtagCount: { min: 2, max: 4 },
    ctaMechanics:
      "Undang diskusi perspektif profesional di kolom komentar; hindari engagement-bait murahan.",
    pacingAndStyleRule:
      "Paragraf 1-2 kalimat dengan spasi putih lega, nada kredibel berbasis pengalaman nyata, bebas jargon kosong.",
  },
  threads: {
    id: "threads",
    label: "Threads",
    primaryFormat: "Conversational Micro-Post / Thread",
    aspectRatio: "Teks / Gambar 4:5 opsional",
    optimalDurationSeconds: { min: 15, max: 45, recommended: 25 },
    hookWindowRule:
      "Kalimat pertama berupa opini jernih, pertanyaan reflektif, atau temuan singkat maksimal 280-500 karakter per utas.",
    maxCaptionLength: 500,
    recommendedHashtagCount: { min: 0, max: 1 },
    ctaMechanics:
      "Akhiri dengan satu pertanyaan terbuka yang mudah dijawab audiens dalam 1 kalimat.",
    pacingAndStyleRule:
      "Sangat ringkas, jujur, seperti catatan pemikiran langsung dari praktisi; maksimal 1 topik tagar.",
  },
  x: {
    id: "x",
    label: "X (Twitter)",
    primaryFormat: "High-Signal Post / Structured Thread",
    aspectRatio: "16:9 atau Teks Utas",
    optimalDurationSeconds: { min: 15, max: 60, recommended: 30 },
    hookWindowRule:
      "Tweet pertama wajib padat informasi (high signal-to-noise) tanpa kata pengisi dalam 240 karakter pertama.",
    maxCaptionLength: 1200,
    recommendedHashtagCount: { min: 0, max: 2 },
    ctaMechanics:
      "Dorong Bookmark untuk dibaca ulang atau Reply berargumen; minimalkan tagar agar tetap bersih.",
    pacingAndStyleRule:
      "To-the-point, berbasis kerangka kerja atau poin konkret per utas, tanpa kalimat bertele-tele.",
  },
};

export function formatPlatformRulesPrompt(platform: SocialPlatformId): string {
  const spec = PLATFORM_RULES[platform];
  return [
    `=== ATURAN SPESIFIK PLATFORM TARGET: ${spec.label.toUpperCase()} ===`,
    `- Format Utama: ${spec.primaryFormat} (${spec.aspectRatio})`,
    `- Rentang Durasi / Panjang Ideal: ${spec.optimalDurationSeconds.min}-${spec.optimalDurationSeconds.max} detik (rekomendasi ~${spec.optimalDurationSeconds.recommended} detik)`,
    `- Aturan Hook Pembuka: ${spec.hookWindowRule}`,
    `- Batas Maksimum Caption: ${spec.maxCaptionLength} karakter`,
    `- Rekomendasi Jumlah Hashtag: ${spec.recommendedHashtagCount.min}-${spec.recommendedHashtagCount.max} hashtag relevan`,
    `- Mekanika CTA Platform: ${spec.ctaMechanics}`,
    `- Gaya & Pacing: ${spec.pacingAndStyleRule}`,
  ].join("\n");
}
