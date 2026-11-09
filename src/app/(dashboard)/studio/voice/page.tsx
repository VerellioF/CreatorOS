import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export const metadata = {
  title: "Voice Studio (Soon) | CreatorOS AI",
  description: "Sintesis voiceover AI natural",
};

export default function VoiceStudioPage() {
  return (
    <ComingSoonCard
      featureName="AI Voiceover Studio"
      categoryName="Studio Audio"
      description="Fitur sulih suara AI natural multi-bahasa disiapkan untuk pembaruan berikutnya. Rekam suara asli Anda menggunakan naskah terstruktur dari Script Studio!"
    />
  );
}
