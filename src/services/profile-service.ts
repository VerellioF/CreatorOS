import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/security/sanitize";
import type { Profile } from "@/lib/supabase/types";
import type { UpdateProfileInput } from "@/lib/validation/auth-schemas";

export class ProfileService {
  /**
   * Retrieves profile by verified user ID.
   * Memoized per-request with React.cache() to prevent redundant DB roundtrips.
   */
  static getProfile = cache(async (userId: string): Promise<Profile | null> => {
    if (!isValidUuid(userId)) {
      return null;
    }

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
  });

  /**
   * Updates caller's own profile data
   */
  static async updateProfile(
    userId: string,
    input: UpdateProfileInput
  ): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    if (!isValidUuid(userId)) {
      return { success: false, error: "Identitas pengguna tidak valid." };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: input.fullName,
        preferred_language: input.preferredLanguage,
        theme_preference: input.themePreference,
      })
      .eq("id", userId)
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: "Gagal memperbarui profil pengguna." };
    }

    return { success: true, profile: data as Profile };
  }
}
