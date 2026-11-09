import * as React from "react";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata = {
  title: "Lupa Password — CreatorOS AI",
  description: "Reset kata sandi akun CreatorOS AI",
};

export default function ForgotPasswordPage() {
  return (
    <React.Suspense fallback={<div className="text-center text-xs text-muted-foreground">Memuat...</div>}>
      <ForgotPasswordForm />
    </React.Suspense>
  );
}
