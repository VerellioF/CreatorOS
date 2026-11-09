import * as React from "react";
import { ComingSoonCard } from "@/components/ui/coming-soon-card";

export const metadata = {
  title: "Billing & Plans (Soon) | CreatorOS AI",
  description: "Paket langganan dan upgrade akun CreatorOS AI",
};

export default function BillingSettingsPage() {
  return (
    <ComingSoonCard
      featureName="Billing & Upgrade Paket"
      categoryName="Sistem & Pembayaran"
      description="Sistem langganan dan pembayaran berbayar saat ini ditandai 'Soon' karena CreatorOS AI sedang dalam fase Public Beta Terbuka. Semua pengguna baru mendapatkan saldo gratis 20 kredit untuk mencoba seluruh alur kreasi konten esensial!"
    />
  );
}
