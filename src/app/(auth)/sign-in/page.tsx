import * as React from "react";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata = {
  title: "Masuk — CreatorOS AI",
  description: "Masuk ke platform CreatorOS AI",
};

export default function SignInPage() {
  return (
    <React.Suspense fallback={<div className="text-center text-xs text-muted-foreground">Memuat...</div>}>
      <SignInForm />
    </React.Suspense>
  );
}
