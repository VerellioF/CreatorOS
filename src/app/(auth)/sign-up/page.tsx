import * as React from "react";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata = {
  title: "Daftar Akun — CreatorOS AI",
  description: "Daftar akun CreatorOS AI baru",
};

export default function SignUpPage() {
  return (
    <React.Suspense fallback={<div className="text-center text-xs text-muted-foreground">Memuat...</div>}>
      <SignUpForm />
    </React.Suspense>
  );
}
