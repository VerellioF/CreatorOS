import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export const metadata = {
  title: "Subtitle Studio (Soon) | CreatorOS AI",
  description: "Pembuat subtitle otomatis",
};

export default function SubtitlesPage() {
  return (
    <ComingSoonCard
      featureName="Auto Subtitle Studio"
      categoryName="Studio Teks"
      description="Fitur generator subtitle otomatis disiapkan untuk pembaruan berikutnya. Anda dapat memanfaatkan caption dan naskah rapi dari Script Studio!"
    />
  );
}
