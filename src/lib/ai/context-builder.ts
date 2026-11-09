import type { CreatorMode } from "@/lib/supabase/types";
import type {
  AdaptiveQuestionItem,
  AudiencePersona,
  CreatorAssessment,
  CreatorDnaEditable,
  MonetizationRecommendationItem,
  NicheRecommendationCandidate,
  OnboardingCoreAnswers,
  RoadmapWeek,
} from "@/lib/validation/creator-intelligence-schemas";
import type { BrandProfileInput } from "@/lib/validation/strategy-and-content-schemas";

export interface SelectedNicheSummary extends NicheRecommendationCandidate {
  id: string;
  isSelected: boolean;
}

export interface ActiveStrategySummary {
  id: string;
  title: string;
  positioningStatement: string;
  uniqueDifferentiator: string;
  publishingFrequencyPerWeek: number;
  pillars: Array<{
    id: string;
    name: string;
    objective: string;
    ratioPercentage: number;
  }>;
}

/**
 * Canonical cross-module Creator Intelligence context reusable across
 * Niche Discovery, Trend Research, Content Strategy, Idea Generator, Script Studio,
 * Storyboard Studio, and Monetization Hub.
 */
export interface WorkspaceCreatorContext {
  workspaceId: string;
  workspaceName: string;
  creatorMode: CreatorMode;
  defaultLanguage: "id" | "en";
  defaultAiModel: string;
  onboardingCompleted: boolean;
  coreAnswers: OnboardingCoreAnswers | null;
  adaptiveQuestions: AdaptiveQuestionItem[];
  adaptiveAnswers: Record<string, string>;
  creatorDna: CreatorDnaEditable | null;
  audiencePersona: AudiencePersona | null;
  creatorAssessment: CreatorAssessment | null;
  monetizationRecommendations: MonetizationRecommendationItem[];
  roadmap30Days: RoadmapWeek[];
  selectedNiche: SelectedNicheSummary | null;
  brandContext?: BrandProfileInput | null;
  activeStrategy?: ActiveStrategySummary | null;
}

const CREATOR_MODE_GUIDANCE: Record<CreatorMode, string> = {
  creator:
    "Creator Mode: Prioritaskan retensi audiens, keaslian suara kreator, konsistensi format, dan pertumbuhan komunitas organik.",
  affiliate:
    "Affiliate Mode: Prioritaskan ulasan jujur berbasis masalah nyata, perbandingan manfaat produk, edukasi pra-pembelian, dan CTA etis tanpa klaim berlebihan.",
  business:
    "Business Mode: Prioritaskan kejelasan solusi produk/jasa, kredibilitas brand, edukasi pelanggan, dan konversi prospek jangka panjang.",
  personal_brand:
    "Personal Brand Mode: Prioritaskan otoritas keahlian, studi kasus nyata, sudut pandang tajam (thought leadership), dan kepercayaan profesional.",
};

/**
 * Serializes the reusable Creator Context + mandatory anti-slop & anti-hype guardrails
 * into a structured prompt block ready for injection into ANY CreatorOS AI module.
 */
export function formatCreatorContextPromptBlock(
  context: WorkspaceCreatorContext
): string {
  const sections: string[] = [
    "=== KONTEKS CREATOROS AI (REUSABLE WORKSPACE INTELLIGENCE) ===",
    `Workspace: ${context.workspaceName}`,
    `Mode Operasi: ${CREATOR_MODE_GUIDANCE[context.creatorMode]}`,
    `Bahasa Utama Output: ${
      context.defaultLanguage === "en" ? "English" : "Bahasa Indonesia"
    }`,
  ];

  if (context.creatorDna) {
    const dna = context.creatorDna;
    sections.push(
      [
        "--- CREATOR DNA AKTIF ---",
        `Nama Kreator/Brand: ${dna.creatorName}`,
        `Niche Utama: ${dna.primaryNiche}`,
        `Sub-Niche Pendukung: ${dna.secondaryNiches.join(", ") || "-"}`,
        `Unique Value Proposition (UVP): ${dna.uniqueValueProposition}`,
        `Arketipe Kepribadian: ${dna.personalityArchetype}`,
        `Tone of Voice: ${dna.toneOfVoice.join(", ")}`,
        `Keunggulan Utama: ${dna.strengths.join(", ")}`,
        `Topik Tabu (WAJIB DIHINDARI): ${dna.tabooTopics.join(", ") || "Tidak ada"}`,
        `Platform Utama: ${dna.primaryPlatforms.join(", ")}`,
        `Format Konten Pilihan: ${dna.preferredFormats.join(", ")}`,
      ].join("\n")
    );
  }

  if (context.selectedNiche) {
    sections.push(
      [
        "--- NICHE PILIHAN PENGGUNA ---",
        `Judul Niche: ${context.selectedNiche.nicheTitle}`,
        `Segmen Audiens Niche: ${context.selectedNiche.audience}`,
        `Tingkat Keyakinan: ${context.selectedNiche.confidenceLevel} (${context.selectedNiche.confidenceScore}/100)`,
      ].join("\n")
    );
  }

  if (context.brandContext) {
    const b = context.brandContext;
    sections.push(
      [
        "--- BRAND CONTEXT & POSITIONING ---",
        `Nama Brand / Identitas: ${b.brandName}`,
        b.tagline ? `Tagline: ${b.tagline}` : "",
        b.positioningStatement
          ? `Positioning Statement: ${b.positioningStatement}`
          : "",
        b.offerSummary ? `Produk / Penawaran Utama: ${b.offerSummary}` : "",
        b.brandValues.length > 0 ? `Nilai Brand: ${b.brandValues.join(", ")}` : "",
        b.voiceGuidelines.length > 0
          ? `Panduan Suara Brand: ${b.voiceGuidelines.join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (context.activeStrategy) {
    const s = context.activeStrategy;
    const pillarLines = s.pillars
      .map((p) => `${p.name} (${p.ratioPercentage}% — ${p.objective})`)
      .join(", ");
    sections.push(
      [
        "--- STRATEGI & PILAR KONTEN AKTIF ---",
        `Strategi: ${s.title} (${s.publishingFrequencyPerWeek}x/minggu)`,
        `Positioning: ${s.positioningStatement}`,
        s.uniqueDifferentiator ? `Diferensiasi: ${s.uniqueDifferentiator}` : "",
        pillarLines ? `Pilar Konten: ${pillarLines}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (context.audiencePersona) {
    const p = context.audiencePersona;
    sections.push(
      [
        "--- AUDIENCE PERSONA ---",
        `Persona: ${p.personaName} (${p.ageRange} — ${p.occupationOrLifeStage})`,
        `Pain Points Utama: ${p.corePainPoints.join("; ")}`,
        `Keinginan/Aspirasi: ${p.coreDesires.join("; ")}`,
        `Kebiasaan Konsumsi Konten: ${p.contentConsumptionHabits}`,
        `Keraguan Umum (Objections): ${p.commonObjections.join("; ")}`,
      ].join("\n")
    );
  }

  if (context.coreAnswers) {
    const c = context.coreAnswers;
    sections.push(
      [
        "--- DATA WAWANCARA ONBOARDING KREATOR ---",
        `Minat: ${c.interests.join(", ")}`,
        `Keahlian: ${c.skills.join(", ")}`,
        `Pengalaman: ${c.experience}${c.experienceNotes ? ` (${c.experienceNotes})` : ""}`,
        `Waktu Tersedia: ${c.availableTime}`,
        `Peralatan: ${c.availableEquipment}${c.equipmentNotes ? ` (${c.equipmentNotes})` : ""}`,
        `Format Pilihan: ${c.preferredContentFormat.join(", ")}`,
        `Target Audiens Awal: ${c.targetAudience}`,
        `Tujuan Utama: ${c.goals}`,
        `Preferensi Monetisasi: ${c.monetizationPreferences.join(", ")}`,
      ].join("\n")
    );
  }

  const adaptiveEntries = Object.entries(context.adaptiveAnswers).filter(
    ([, val]) => val.trim().length > 0
  );
  if (adaptiveEntries.length > 0) {
    const mapped = adaptiveEntries.map(([qId, ans]) => {
      const qObj = context.adaptiveQuestions.find((q) => q.id === qId);
      return `- ${qObj ? qObj.question : qId}: ${ans}`;
    });
    sections.push(["--- JAWABAN WAWANCARA ADAPTIF LANJUTAN ---", ...mapped].join("\n"));
  }

  sections.push(
    [
      "--- ATURAN WAJIB KUALITAS & ETIKA (NON-NEGOTIABLE GUARDRAILS) ---",
      "1. DILARANG KERAS menjanjikan penghasilan pasti, nominal uang pasti, cepat kaya, atau jaminan viral (mis. JANGAN gunakan frasa 'dijamin viral', 'pasti viral', 'dijamin cuan', 'auto kaya', atau 'guaranteed income').",
      "2. DILARANG mengarang statistik pasar, angka volume pencarian palsu, atau sitasi fiktif. Jika data riset eksternal belum tersedia, nyatakan secara eksplisit bahwa penilaian bersifat kualitatif berbasis profil kreator.",
      "3. Hindari saran klise/generik (No AI Slop); sesuaikan seluruh rekomendasi dengan batasan waktu, peralatan, keahlian, dan Creator Mode pengguna.",
    ].join("\n")
  );

  return sections.join("\n\n");
}

/**
 * Generates deterministic, profile-branched adaptive follow-up questions immediately
 * tailored to the user's specific Creator Mode, experience, equipment, time, and monetization answers.
 * Used both as an instant adaptive step and merged/enriched when AI Adaptive Probing runs.
 */
export function buildAdaptiveBaselineQuestions(
  core: OnboardingCoreAnswers
): AdaptiveQuestionItem[] {
  const questions: AdaptiveQuestionItem[] = [];

  // Branch 1: Creator Mode specific probing
  if (core.creatorMode === "affiliate") {
    questions.push({
      id: "adaptive_affiliate_category",
      question: `Untuk Affiliate Mode di bidang "${core.interests[0] ?? "pilihan Anda"}", kategori produk apa yang benar-benar pernah Anda pakai sendiri atau mudah Anda akses untuk didemokan?`,
      whyItMatters:
        "Konten afiliasi yang kredibel dan tahan lama membutuhkan bukti pemakaian nyata atau pemahaman produk mendalam, bukan sekadar baca spesifikasi.",
      targetDimension: "monetization_fit",
      placeholder:
        "Contoh: Peralatan kerja meja/ergonomis harga Rp100rb-500rb yang sehari-hari saya pakai kerja",
      options: [
        "Produk yang sudah saya miliki di rumah/kantor",
        "Produk digital / software yang saya gunakan",
        "Produk kebutuhan harian dengan harga terjangkau",
      ],
    });
  } else if (core.creatorMode === "business") {
    questions.push({
      id: "adaptive_business_offer",
      question:
        "Produk atau layanan spesifik apa yang saat ini dijual bisnis Anda, dan pertanyaan apa yang paling sering ditanyakan calon pembeli sebelum membeli?",
      whyItMatters:
        "Pertanyaan pra-pembelian pelanggan adalah sumber konten edukasi dan konversi paling akurat untuk Business Mode.",
      targetDimension: "monetization_fit",
      placeholder:
        "Contoh: Jasa desain interior apartemen; klien sering bingung soal estimasi biaya transparan",
      options: [
        "Produk fisik brand sendiri (DTC/UMKM)",
        "Jasa profesional B2B / B2C",
        "Aplikasi / produk berlangganan",
      ],
    });
  } else if (core.creatorMode === "personal_brand") {
    questions.push({
      id: "adaptive_authority_proof",
      question: `Berdasarkan keahlian Anda (${core.skills.slice(0, 2).join(", ")}), pengalaman nyata atau kesalahan mahal apa yang pernah Anda lalui dan bisa menjadi pelajaran berharga bagi ${core.targetAudience}?`,
      whyItMatters:
        "Personal brand yang kuat dibangun dari studi kasus nyata dan sudut pandang praktis, bukan teori umum.",
      targetDimension: "differentiation",
      placeholder:
        "Contoh: Pengalaman mengelola tim remote 5 tahun dan gagal rekrutmen di tahun pertama",
    });
  } else {
    questions.push({
      id: "adaptive_unique_angle",
      question: `Di antara minat Anda (${core.interests.slice(0, 3).join(", ")}) dan keahlian (${core.skills.slice(0, 2).join(", ")}), perspektif atau gaya penyampaian seperti apa yang paling terasa alami bagi Anda?`,
      whyItMatters:
        "Menggabungkan minat dengan gaya komunikasi alami mencegah kelelahan kreator (burnout) di 30 hari pertama.",
      targetDimension: "differentiation",
      placeholder:
        "Contoh: Membahas topik teknis dengan analogi sederhana seperti ngobrol sama teman tongkrongan",
      options: [
        "Santai & bercerita seperti teman sebaya",
        "To-the-point, terstruktur, dan berbasis tutorial praktis",
        "Kritis, membedah miskonsepsi umum di topik tersebut",
      ],
    });
  }

  // Branch 2: Equipment & Format constraint probing
  if (
    core.availableEquipment === "laptop_screen_faceless_only" ||
    core.preferredContentFormat.includes("short_video_faceless_broll")
  ) {
    questions.push({
      id: "adaptive_faceless_workflow",
      question:
        "Karena Anda memilih pendekatan faceless / tanpa tampil wajah penuh, aset visual apa yang paling realistis Anda rekam atau siapkan setiap minggu?",
      whyItMatters:
        "Menentukan sumber visual sejak awal memastikan konten faceless tetap orisinal dan tidak terlihat generik.",
      targetDimension: "production_constraint",
      placeholder:
        "Contoh: Rekam layar tutorial (screen recording) ditambah voiceover suara sendiri",
      options: [
        "Rekam layar (screen recording) + suara sendiri",
        "Rekaman tangan / meja kerja (POV shot) dengan HP",
        "Slide visual / carousel terstruktur + narasi suara",
      ],
    });
  } else if (core.availableEquipment === "smartphone_only") {
    questions.push({
      id: "adaptive_smartphone_environment",
      question:
        "Dengan setup Smartphone saja, kapan dan di mana lokasi paling tenang yang bisa Anda gunakan secara konsisten untuk merekam audio yang jernih?",
      whyItMatters:
        "Kualitas suara jauh lebih menentukan retensi penonton dibanding kamera mahal.",
      targetDimension: "production_constraint",
      placeholder:
        "Contoh: Kamar kerja malam hari jam 20.00-21.30 atau pagi sebelum berangkat kerja",
      options: [
        "Di kamar/ruang tertutup pada malam atau pagi hari",
        "Sambil aktivitas harian (vlog kontekstual)",
        "Rekam visual dulu, isi voiceover belakangan di tempat tenang",
      ],
    });
  } else {
    questions.push({
      id: "adaptive_production_bottleneck",
      question:
        "Dengan peralatan Anda saat ini, tahap produksi mana yang biasanya paling memakan waktu Anda (riset ide, menulis skrip, rekaman, atau editing)?",
      whyItMatters:
        "Roadmap 30 hari akan menyederhanakan tahap yang paling sering menghambat konsistensi Anda.",
      targetDimension: "production_constraint",
      placeholder: "Contoh: Paling lama saat nulis hook awal dan mengedit potongan video",
      options: [
        "Mencari ide & merangkai kalimat pembuka (hook)",
        "Proses pengambilan gambar / bicara di depan kamera",
        "Proses editing video dan teks subtitle",
      ],
    });
  }

  // Branch 3: Audience Pain Point specificity
  questions.push({
    id: "adaptive_audience_urgent_problem",
    question: `Jika Anda membayangkan satu orang spesifik dari "${core.targetAudience}", masalah paling mendesak apa yang ingin mereka selesaikan minggu ini tetapi sering salah kaprah?`,
    whyItMatters:
      "Semakin tajam masalah spesifik yang dijawab konten Anda, semakin mudah audiens merasa konten tersebut dibuat khusus untuk mereka.",
    targetDimension: "audience_pain_point",
    placeholder:
      "Contoh: Ingin mulai menabung rutin tapi selalu habis di minggu kedua karena pengeluaran kecil tak tercatat",
  });

  // Branch 4: Experience / Time / Taboo boundaries
  questions.push({
    id: "adaptive_boundaries_and_taboo",
    question: `Dengan alokasi waktu (${core.availableTime.replaceAll("_", " ")}), adakah batasan topik sensitif atau gaya konten yang TIDAK ingin Anda sentuh sama sekali?`,
    whyItMatters:
      "Menetapkan batasan (taboo topics) di Creator DNA menjaga seluruh skrip dan ide AI tetap sesuai prinsip dan kenyamanan Anda.",
    targetDimension: "niche_specificity",
    placeholder:
      "Contoh: Tidak ingin bahas politik, drama gosip, atau pamer nominal gaji pribadi",
  });

  return questions;
}
