"use server";

import { AuthService } from "@/services/auth-service";
import { enforceServerActionRateLimit } from "@/lib/security/rate-limit";
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  type SignInInput,
  type SignUpInput,
  type ForgotPasswordInput,
} from "@/lib/validation/auth-schemas";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1_000;

export async function signInAction(input: SignInInput) {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  const rateLimit = await enforceServerActionRateLimit({
    action: "auth:sign-in",
    identifier: parsed.data.email,
    limit: 10,
    windowMs: FIFTEEN_MINUTES_MS,
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
    };
  }

  return await AuthService.signIn(parsed.data);
}

export async function signUpAction(input: SignUpInput) {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  const rateLimit = await enforceServerActionRateLimit({
    action: "auth:sign-up",
    limit: 5,
    windowMs: FIFTEEN_MINUTES_MS,
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Terlalu banyak percobaan pendaftaran. Silakan coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
    };
  }

  return await AuthService.signUp(parsed.data);
}

export async function forgotPasswordAction(input: ForgotPasswordInput) {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Input tidak valid" };
  }

  const rateLimit = await enforceServerActionRateLimit({
    action: "auth:forgot-password",
    identifier: parsed.data.email,
    limit: 5,
    windowMs: FIFTEEN_MINUTES_MS,
  });

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Terlalu banyak permintaan reset password. Silakan coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`,
    };
  }

  return await AuthService.resetPassword(parsed.data);
}

export async function signOutAction() {
  return await AuthService.signOut();
}
