import { createClient } from "@/lib/supabase/server";
import { clearActiveWorkspaceCookie } from "@/lib/security/workspace-cookie";
import type {
  SignInInput,
  SignUpInput,
  ForgotPasswordInput,
} from "@/lib/validation/auth-schemas";

export interface AuthResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

function mapSafeAuthError(rawMessage: string | undefined, fallback: string): string {
  if (!rawMessage) {
    return fallback;
  }

  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid_credentials")
  ) {
    return "Email atau password yang Anda masukkan salah.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Email Anda belum dikonfirmasi. Silakan periksa kotak masuk email Anda.";
  }

  if (normalized.includes("user already registered")) {
    return "Tidak dapat menyelesaikan pendaftaran dengan email tersebut. Silakan masuk atau gunakan pemulihan kata sandi.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Terlalu banyak percobaan. Silakan tunggu beberapa saat sebelum mencoba kembali.";
  }

  if (normalized.includes("password should be at least")) {
    return "Password minimal 8 karakter dengan kombinasi yang aman.";
  }

  return fallback;
}

export class AuthService {
  /**
   * Signs in a user with email and password without leaking raw session tokens to the client.
   */
  static async signIn(input: SignInInput): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        return {
          success: false,
          error: mapSafeAuthError(
            error.message,
            "Gagal masuk. Periksa kembali email dan password Anda."
          ),
        };
      }

      return { success: true };
    } catch {
      return { success: false, error: "Terjadi kesalahan layanan saat masuk." };
    }
  }

  /**
   * Registers a new user with full name and credentials without exposing raw JWT payloads.
   */
  static async signUp(input: SignUpInput): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
          },
        },
      });

      if (error) {
        return {
          success: false,
          error: mapSafeAuthError(
            error.message,
            "Pendaftaran tidak dapat diproses saat ini. Silakan coba kembali."
          ),
        };
      }

      return { success: true };
    } catch {
      return { success: false, error: "Terjadi kesalahan layanan saat mendaftar." };
    }
  }

  /**
   * Signs out the current user session and purges active workspace cookie state.
   */
  static async signOut(): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut();
      await clearActiveWorkspaceCookie();

      if (error) {
        return { success: false, error: "Gagal mengakhiri sesi." };
      }

      return { success: true };
    } catch {
      await clearActiveWorkspaceCookie().catch(() => {});
      return { success: false, error: "Gagal mengakhiri sesi." };
    }
  }

  /**
   * Sends password reset email while preventing account enumeration.
   */
  static async resetPassword(input: ForgotPasswordInput): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(input.email);

      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes("rate limit") || lower.includes("too many requests")) {
          return {
            success: false,
            error: "Terlalu banyak permintaan reset password. Silakan coba lagi nanti.",
          };
        }
        // Return uniform success to prevent email/account enumeration
        return { success: true };
      }

      return { success: true };
    } catch {
      return { success: false, error: "Gagal memproses permintaan reset password." };
    }
  }

  /**
   * Retrieves current server-verified authenticated user via `supabase.auth.getUser()`.
   */
  static async getCurrentUser() {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return null;
      }

      return user;
    } catch {
      return null;
    }
  }
}
