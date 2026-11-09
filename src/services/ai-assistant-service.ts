import {
  aiAssistantRequestSchema,
  aiAssistantResponseSchema,
  type AiAssistantPersona,
  type AiAssistantRequest,
  type AiAssistantResponse,
} from "@/lib/validation/ai-assistant-schemas";
import { executeValidatedStructuredGeneration, getProviderAvailability } from "@/lib/ai/provider-registry";
import { CreatorContextService } from "@/services/creator-context-service";
import { UsageBillingService } from "@/services/usage-billing-service";
import { AI_OPERATION_CREDIT_COSTS } from "@/lib/ai/token-budget";
import { z } from "zod";

const PERSONA_PROMPTS: Record<AiAssistantPersona, string> = {
  strategist: `Anda adalah Principal Content Strategist di CreatorOS AI.
Tugas Anda: Membantu kreator merancang pilar konten, positioning diferensiasi, validasi ide baru, dan strategi pertumbuhan jangka panjang.
Gaya Komunikasi: Analitis, suportif, berorientasi data lapangan, ringkas, dan fokus pada eksekusi nyata di media sosial Indonesia.`,
  
  hook_doctor: `Anda adalah Hook & Retention Specialist di CreatorOS AI.
Tugas Anda: Membedah 3 detik pertama video/naskah kreator. Ubah opening klise atau membosankan menjadi hook dengan retensi tinggi (pattern interrupt, visual contrast, polarizing question, mystery box, curiosity gap).
Gaya Komunikasi: Kritis namun membangun, memberikan perbandingan Sebelum vs Sesudah secara eksplisit.`,

  scriptwriter: `Anda adalah Lead Viral Scriptwriter di CreatorOS AI.
Tugas Anda: Menyusun kerangka naskah video pendek (TikTok, Reels, Shorts) dengan struktur Hook -> Retensi/Masalah -> Solusi Berbobot -> CTA tajam.
Gaya Komunikasi: Mengalir, natural saat dibaca langsung di depan kamera (spoken-first language), bebas kalimat kaku.`,

  algorithm_advisor: `Anda adalah Platform Algorithm & Distribution Advisor di CreatorOS AI.
Tugas Anda: Memberikan saran optimasi waktu posting, format rasio, struktur hashtag semantik, SEO pencarian TikTok/IG, dan metrik interaksi (Watch Time, Completion Rate, Shares).
Gaya Komunikasi: Taktis, berbasis pemahaman cara kerja rekomendasi algoritma modern.`,
};

export class AiAssistantService {
  /**
   * Menghasilkan respons percakapan asisten AI berkonteks Creator DNA & Workspace
   */
  static async chat(
    userId: string,
    params: AiAssistantRequest
  ): Promise<AiAssistantResponse> {
    const validated = aiAssistantRequestSchema.parse(params);
    const { workspaceId, message, persona, conversationHistory } = validated;

    // Ambil konteks Creator DNA jika ada
    const creatorContext = await CreatorContextService.getWorkspaceCreatorContext(
      workspaceId,
      userId
    );

    const dna = creatorContext?.creatorDna;
    const niche = creatorContext?.selectedNiche;
    const audience = creatorContext?.audiencePersona;

    const contextSection = dna
      ? `\n\nKONTEKS KREATOR:
- Nama Kreator: ${dna.creatorName}
- Niche Utama: ${dna.primaryNiche} (${niche?.nicheTitle || "General"})
- Arketipe Persona: ${dna.personalityArchetype}
- Tone of Voice: ${dna.toneOfVoice.join(", ")}
- Value Proposition: ${dna.uniqueValueProposition}
${audience ? `- Target Audiens: ${audience.personaName} (Pain Points: ${audience.corePainPoints.join("; ")})` : ""}`
      : "\n\nKreator belum menyelesaikan onboarding Creator DNA secara lengkap.";

    const historySection = conversationHistory && conversationHistory.length > 0
      ? `\n\nRIWAYAT PERCAKAPAN TERAKHIR:\n` +
        conversationHistory
          .slice(-6)
          .map((m) => `${m.role === "user" ? "Kreator" : "Asisten"}: ${m.content}`)
          .join("\n")
      : "";

    const systemPrompt = `${PERSONA_PROMPTS[persona]}${contextSection}${historySection}

Aturan Wajib:
1. Jawab dalam Bahasa Indonesia yang segar, profesional, dan relevan dengan audiens Indonesia.
2. Berikan tanggapan langsung pada poin utama pertanyaan kreator tanpa basa-basi berlebih.
3. Selalu sertakan 2-4 pertanyaan lanjutan (suggestedFollowUps) dan 2-4 langkah aksi konkrit (actionItems).`;

    const userPrompt = `Pesan dari kreator:\n"${message}"\n\nBerikan panduan dan solusi terstruktur terbaik Anda.`;

    const availability = getProviderAvailability();

    // Jika penyedia AI aktif terkonfigurasi (Gemini / OpenAI)
    if (availability.anyConfigured) {
      const result = await executeValidatedStructuredGeneration({
        workspaceId,
        userId,
        agentName: `ai_assistant_${persona}`,
        operationType: "ai_assistant_chat",
        systemPrompt,
        userPrompt,
        schemaName: "ai_assistant_response",
        jsonSchema: {
          type: "object",
          properties: {
            reply: { type: "string" },
            suggestedFollowUps: { type: "array", items: { type: "string" } },
            actionItems: { type: "array", items: { type: "string" } },
            confidenceScore: { type: "number" },
          },
          required: ["reply", "suggestedFollowUps", "actionItems"],
        },
        zodSchema: aiAssistantResponseSchema,
        maxOutputTokens: 2048,
      });

      return result.data;
    }

    // Deterministic High-Quality Fallback saat offline/tanpa API key pihak ketiga
    const requiredCredits = AI_OPERATION_CREDIT_COSTS.ai_assistant_chat;
    await UsageBillingService.assertSufficientCredits(workspaceId, userId, requiredCredits);

    const fallbackResponse = this.generateContextualFallback(
      message,
      persona,
      dna?.creatorName,
      dna?.primaryNiche
    );

    return fallbackResponse;
  }

  private static generateContextualFallback(
    message: string,
    persona: AiAssistantPersona,
    creatorName?: string,
    niche?: string
  ): AiAssistantResponse {
    const greeting = creatorName ? `Halo ${creatorName}!` : "Halo Kreator!";
    const nicheContext = niche ? ` di niche ${niche}` : "";

    switch (persona) {
      case "hook_doctor":
        return {
          reply: `${greeting} Untuk hook konten${nicheContext}, prinsip utamanya adalah "Pattern Interrupt" dalam 1.5 detik pertama. 

Hindari pembukaan standar seperti "Hai semua..." atau "Kali ini aku mau share...". 
Sebaliknya, gunakan formula "Kontras + Kerugian Nyata":
1. *Hook Versi Kontras:* "90% kreator salah kaprah soal ${message.slice(0, 30)}... Ini rahasia yang jarang dibahas!"
2. *Hook Versi Rasa Penasaran:* "Kalau kamu masih bikin konten dengan cara ini, siap-siap videomu sepi penonton."

Selalu tampilkan visual gerak atau teks tegas di layar pada detik ke-0 agar penonton tidak langsung scroll lewat!`,
          suggestedFollowUps: [
            "Bagaimana cara transisi mulus dari hook ke isi video?",
            "Berapa detik durasi ideal untuk hook di TikTok vs Shorts?",
            "Contoh hook visual tanpa bicara untuk 3 detik pertama",
          ],
          actionItems: [
            "Tulis 3 variasi hook alternatif untuk naskah ini sebelum merekam.",
            "Uji coba rekam bagian hook terlebih dahulu dengan ekspresi vokal lebih berenergi.",
            "Tambahkan efek teks pop-up tebal pada 2 detik pembuka.",
          ],
          confidenceScore: 0.95,
        };

      case "scriptwriter":
        return {
          reply: `${greeting} Berikut adalah struktur naskah terarah untuk ide "${message}":

**[00:00 - 00:03] The Hook**
"Trik tercepat untuk ${message.slice(0, 40)} tanpa perlu ribet."

**[00:03 - 00:15] Relatable Conflict**
Jelaskan masalah umum yang sering dihadapi audiens saat mencoba hal ini, dan kenapa metode lama sudah kurang efektif.

**[00:15 - 00:45] The 3 Golden Steps (Core Value)**
- *Poin 1:* Fondasi terpenting yang wajib disiapkan.
- *Poin 2:* Eksekusi praktis langkah demi langkah.
- *Poin 3:* Hal krusial yang sering dilupakan orang kebanyakan.

**[00:45 - 00:55] Actionable CTA**
"Simpan video ini biar nggak lupa pas mau praktek nanti, dan share ke teman konten kreatormu!"`,
          suggestedFollowUps: [
            "Adaptasikan naskah ini ke format Carousel Instagram",
            "Bantu buatkan caption SEO dan hashtag untuk naskah ini",
            "Bagaimana cara memotong naskah ini menjadi format 30 detik?",
          ],
          actionItems: [
            "Buka Studio Naskah (/studio/scripts) untuk menyimpan paket naskah ini.",
            "Latihan membaca naskah dengan tempo 130-150 kata per menit.",
            "Siapkan B-roll visual pendukung untuk poin 1 sampai 3.",
          ],
          confidenceScore: 0.96,
        };

      case "algorithm_advisor":
        return {
          reply: `${greeting} Terkait optimasi algoritma untuk "${message}":

1. **Watch Time & Completion Rate**: Algoritma TikTok & Reels memprioritaskan video dengan retention di atas 45%. Pastikan tidak ada jeda hening lebih dari 0.5 detik di antara kalimat.
2. **Search Intent (TikTok SEO)**: Masukkan kata kunci utama "${message.slice(0, 25)}" secara natural di 3 tempat: (a) Suara yang diucapkan (spoken), (b) Teks stiker di layar, dan (c) 2 kalimat pertama caption.
3. **Waktu Unggah Terbaik**: Untuk audiens Indonesia, golden hours berada di jam 11:30 - 13:00 WIB (istirahat siang) dan 18:30 - 21:00 WIB (prime time malam).`,
          suggestedFollowUps: [
            "Berapa jumlah hashtag ideal per postingan saat ini?",
            "Bagaimana cara membaca metrik Drop-off Rate di Analytics?",
            "Apakah menghapus video yang sepi merusak algoritma akun?",
          ],
          actionItems: [
            "Riset 3-5 hashtag kata kunci spesifik di menu Trend Research (/trends).",
            "Gunakan fitur Subtitle Studio (/studio/subtitles) agar video ramah tonton tanpa suara.",
            "Jadwalkan tayang di Publishing Center (/publish) pada jam prime time.",
          ],
          confidenceScore: 0.94,
        };

      case "strategist":
      default:
        return {
          reply: `${greeting} Analisis strategis untuk pertanyaan Anda mengenai "${message}":

Untuk membangun konsistensi brand${nicheContext}, pastikan setiap konten memenuhi setidaknya satu dari segitiga pilar:
- **Pilar Authority (40%)**: Konten edukasi mendalam yang membuktikan keahlian Anda.
- **Pilar Relatability (40%)**: Cerita nyata, perjuangan, opini, atau kesalahan yang pernah Anda buat.
- **Pilar Conversion (20%)**: Ajakan bergabung, klik link bio, atau monetisasi.

Dengan menyeimbangkan ketiga pilar ini, audiens tidak hanya terhibur, tetapi juga terkonversi menjadi pengikut setia dan pelanggan.`,
          suggestedFollowUps: [
            "Bagaimana cara menentukan 3 pilar konten utama saya?",
            "Bantu saya membuat jadwal kalender posting untuk 1 minggu ke depan",
            "Bagaimana cara mengukur apakah positioning saya sudah tepat?",
          ],
          actionItems: [
            "Buka menu Content Strategy (/strategy) untuk memetakan pilar aktif.",
            "Gunakan Idea Generator (/ideas) untuk menghasilkan 10 topik turunan.",
            "Tentukan jadwal posting mingguan di Content Calendar (/calendar).",
          ],
          confidenceScore: 0.95,
        };
    }
  }
}
