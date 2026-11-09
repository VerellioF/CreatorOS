import { describe, it, expect } from "vitest";
import { signInSchema, signUpSchema, updateProfileSchema } from "@/lib/validation/auth-schemas";
import { createWorkspaceSchema } from "@/lib/validation/workspace-schemas";

describe("Validation Schemas Suite", () => {
  describe("signInSchema", () => {
    it("validates correct email and password", () => {
      const res = signInSchema.safeParse({
        email: "creator@example.com",
        password: "secretpassword123",
      });
      expect(res.success).toBe(true);
    });

    it("rejects invalid email formats", () => {
      const res = signInSchema.safeParse({
        email: "not-an-email",
        password: "password123",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Format email tidak valid");
      }
    });

    it("rejects password shorter than 6 characters", () => {
      const res = signInSchema.safeParse({
        email: "creator@example.com",
        password: "123",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Password minimal 6 karakter");
      }
    });
  });

  describe("signUpSchema", () => {
    it("accepts matching password and confirmPassword", () => {
      const res = signUpSchema.safeParse({
        fullName: "Budi Santoso",
        email: "budi@creator.id",
        password: "securePassword123",
        confirmPassword: "securePassword123",
      });
      expect(res.success).toBe(true);
    });

    it("rejects non-matching confirmPassword", () => {
      const res = signUpSchema.safeParse({
        fullName: "Budi Santoso",
        email: "budi@creator.id",
        password: "securePassword123",
        confirmPassword: "differentPassword123",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Konfirmasi password tidak cocok");
      }
    });
  });

  describe("createWorkspaceSchema", () => {
    it("accepts valid name and slug", () => {
      const res = createWorkspaceSchema.safeParse({
        name: "Acme Agency",
        slug: "acme-agency",
        creatorMode: "business",
      });
      expect(res.success).toBe(true);
    });

    it("rejects slug with invalid characters and spaces", () => {
      const res = createWorkspaceSchema.safeParse({
        name: "Acme Agency",
        slug: "Acme Agency Invalid!",
        creatorMode: "business",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toContain("Slug hanya boleh berisi huruf kecil");
      }
    });
  });

  describe("updateProfileSchema", () => {
    it("validates language and theme preferences", () => {
      const res = updateProfileSchema.safeParse({
        fullName: "Sarah Creator",
        preferredLanguage: "id",
        themePreference: "dark",
      });
      expect(res.success).toBe(true);
    });
  });
});
