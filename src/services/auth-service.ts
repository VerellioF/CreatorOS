import { createClient } from "@/lib/supabase/server";
import type { SignInInput, SignUpInput, ForgotPasswordInput } from "@/lib/validation/auth-schemas";

export interface AuthResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AuthService {
  /**
   * Signs in a user with email and password
   */
  static async signIn(input: SignInInput): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat masuk";
      return { success: false, error: message };
    }
  }

  /**
   * Registers a new user with full name and credentials
   */
  static async signUp(input: SignUpInput): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan saat mendaftar";
      return { success: false, error: message };
    }
  }

  /**
   * Signs out the current user session
   */
  static async signOut(): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal keluar";
      return { success: false, error: message };
    }
  }

  /**
   * Sends password reset email
   */
  static async resetPassword(input: ForgotPasswordInput): Promise<AuthResult> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(input.email);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengirim link reset password";
      return { success: false, error: message };
    }
  }

  /**
   * Retrieves current authenticated user
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
