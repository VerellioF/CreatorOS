import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export const metadata = {
  title: "Trend Research (Soon) | CreatorOS AI",
  description: "Pantau tren viral dan hashtag naik daun",
};

export default function TrendResearchPage() {
  return (
    <ComingSoonCard
      featureName="Trend Research Radar"
      categoryName="Riset Lanjutan"
      description="Fitur pemantauan radar tren mendalam disiapkan untuk pembaruan berikutnya. Di fase Public Beta ini, fokuslah menghasilkan naskah viral dan ide konten terbaik Anda secara gratis!"
    />
  );
}
