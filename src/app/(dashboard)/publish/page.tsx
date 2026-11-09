import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export const metadata = {
  title: "Publishing Center (Soon) | CreatorOS AI",
  description: "Distribusi dan jadwal publikasi multi-platform",
};

export default function PublishingPage() {
  return (
    <ComingSoonCard
      featureName="Publishing Center & Direct Posting"
      categoryName="Distribusi Konten"
      description="Fitur auto-posting langsung ke platform sosial disiapkan untuk pembaruan berikutnya. Gunakan Content Calendar untuk memetakan jadwal tayang konten Anda!"
    />
  );
}
