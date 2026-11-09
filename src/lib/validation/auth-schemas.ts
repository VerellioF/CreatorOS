import { z } from "zod";
import { stripControlChars } from "@/lib/security/sanitize";

const emailField = z
  .string()
  .transform((val) => stripControlChars(val).trim().toLowerCase())
  .pipe(
    z
      .string()
      .max(254, "Email maksimal 254 karakter")
      .email("Format email tidak valid")
  );

const sanitizedFullNameField = (minMessage: string) =>
  z
    .string()
    .transform((val) => stripControlChars(val).trim())
    .pipe(
      z
        .string()
        .min(2, minMessage)
        .max(100, "Nama lengkap maksimal 100 karakter")
    );

export const signInSchema = z
  .object({
    email: emailField,
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .max(128, "Password maksimal 128 karakter"),
  })
  .strict();

export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    fullName: sanitizedFullNameField("Nama lengkap minimal 2 karakter"),
    email: emailField,
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter"),
    confirmPassword: z
      .string()
      .min(8, "Konfirmasi password minimal 8 karakter")
      .max(128, "Konfirmasi password maksimal 128 karakter"),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z
  .object({
    email: emailField,
  })
  .strict();

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const updateProfileSchema = z
  .object({
    fullName: sanitizedFullNameField("Nama minimal 2 karakter"),
    preferredLanguage: z.enum(["id", "en"]).default("id"),
    themePreference: z.enum(["dark", "light", "system"]).default("system"),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
