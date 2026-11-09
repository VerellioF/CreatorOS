import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import type { UpdateProfileInput } from "@/lib/validation/auth-schemas";

export class ProfileService {
  /**
   * Retrieves profile by user ID
   */
  static async getProfile(userId: string): Promise<Profile | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Profile;
  }

  /**
   * Updates profile data
   */
  static async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: input.fullName,
        preferred_language: input.preferredLanguage,
        theme_preference: input.themePreference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Gagal memperbarui profil" };
    }

    return { success: true, profile: data as Profile };
  }
}
