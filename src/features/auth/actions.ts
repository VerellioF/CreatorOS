"use server";

import { AuthService } from "@/services/auth-service";
import { signInSchema, signUpSchema, forgotPasswordSchema, type SignInInput, type SignUpInput, type ForgotPasswordInput } from "@/lib/validation/auth-schemas";

export async function signInAction(input: SignInInput) {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  return await AuthService.signIn(parsed.data);
}

export async function signUpAction(input: SignUpInput) {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  return await AuthService.signUp(parsed.data);
}

export async function forgotPasswordAction(input: ForgotPasswordInput) {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  return await AuthService.resetPassword(parsed.data);
}
