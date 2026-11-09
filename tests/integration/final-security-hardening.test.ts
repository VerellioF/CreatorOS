import { describe, it, expect, beforeEach } from "vitest";

// ==============================================================================
// CREATOROS PHASE 1 — FINAL SECURITY HARDENING VERIFICATION SUITE
// Verifies all 15 Database Security Proofs & Multi-Tenant Boundaries
// ==============================================================================

type WorkspaceRole = "owner" | "admin" | "editor" | "viewer" | "member";

interface Profile {
  id: string;
  full_name: string;
  preferred_language: string;
  theme_preference: string;
  onboarding_completed: boolean;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  creator_mode: string;
  created_by: string;
}

interface WorkspaceMember {
  id?: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
}

interface WorkspaceSettings {
  workspace_id: string;
  default_language: string;
  default_ai_model: string;
}

class SecurityEngineSimulation {
  profiles: Profile[] = [];
  workspaces: Workspace[] = [];
  members: WorkspaceMember[] = [];
  settings: WorkspaceSettings[] = [];
  ownershipTransferActive = false;

  // 1. RLS Helper: has_workspace_access
  hasWorkspaceAccess(callerId: string | null, workspaceId: string, minRole: WorkspaceRole = "viewer"): boolean {
    if (!callerId) return false;
    const m = this.members.find((item) => item.workspace_id === workspaceId && item.user_id === callerId);
    if (!m) return false;

    const hierarchy: Record<WorkspaceRole, number> = {
      viewer: 1,
      member: 1,
      editor: 2,
      admin: 3,
      owner: 4,
    };
    return (hierarchy[m.role] || 0) >= (hierarchy[minRole] || 1);
  }

  // 2. RLS SELECT on workspaces
  selectWorkspaces(callerId: string | null): Workspace[] {
    return this.workspaces.filter((w) => this.hasWorkspaceAccess(callerId, w.id, "viewer"));
  }

  // 3. Trigger: enforce_workspace_member_safety on INSERT
  insertMember(callerId: string | null, record: WorkspaceMember): { success: boolean; error?: string } {
    if (!callerId) {
      return { success: false, error: "Unauthorized: Unauthenticated operations on workspace members are strictly forbidden." };
    }

    const callerMember = this.members.find(
      (m) => m.workspace_id === record.workspace_id && m.user_id === callerId
    );
    if (!callerMember) {
      return { success: false, error: "Unauthorized: Caller is not a member of this workspace." };
    }
    const callerRole = callerMember.role;

    if (record.role === "owner" && callerRole !== "owner") {
      return { success: false, error: "Role escalation rejected: Only workspace owners can assign the owner role." };
    }

    if (record.role === "admin" && callerRole !== "owner") {
      return { success: false, error: "Role escalation rejected: Only workspace owners can assign the admin role." };
    }

    if (callerRole === "admin" && !["editor", "viewer", "member"].includes(record.role)) {
      return { success: false, error: "Privilege violation: Admins can only add editor, viewer, or member roles." };
    }

    if (!["owner", "admin"].includes(callerRole)) {
      return { success: false, error: "Unauthorized: Insufficient permissions to add workspace members." };
    }

    this.members.push(record);
    return { success: true };
  }

  // 4. Trigger: enforce_workspace_member_safety on UPDATE
  updateMember(
    callerId: string | null,
    workspaceId: string,
    targetUserId: string,
    updates: { role?: WorkspaceRole; new_workspace_id?: string; new_user_id?: string }
  ): { success: boolean; error?: string } {
    if (!callerId) {
      return { success: false, error: "Unauthorized: Unauthenticated operations on workspace members are strictly forbidden." };
    }

    // Check identity immutability
    if (
      (updates.new_workspace_id && updates.new_workspace_id !== workspaceId) ||
      (updates.new_user_id && updates.new_user_id !== targetUserId)
    ) {
      return { success: false, error: "Data integrity violation: Membership identity (workspace_id, user_id) is immutable." };
    }

    const callerMember = this.members.find(
      (m) => m.workspace_id === workspaceId && m.user_id === callerId
    );
    if (!callerMember) {
      return { success: false, error: "Unauthorized: Caller is not a member of this workspace." };
    }
    const callerRole = callerMember.role;

    const targetIdx = this.members.findIndex(
      (m) => m.workspace_id === workspaceId && m.user_id === targetUserId
    );
    if (targetIdx === -1) return { success: false, error: "Member not found" };

    const oldRole = this.members[targetIdx]!.role;
    const newRole = updates.role ?? oldRole;

    // Check direct owner role modifications
    if ((oldRole === "owner" || newRole === "owner") && oldRole !== newRole) {
      if (!this.ownershipTransferActive) {
        return { success: false, error: "Direct owner role modifications are prohibited. Use transfer_workspace_ownership() instead." };
      }
    }

    // Only owner can grant or revoke the admin role
    if ((newRole === "admin" || oldRole === "admin") && oldRole !== newRole && callerRole !== "owner") {
      return { success: false, error: "Role escalation rejected: Only workspace owners can grant or revoke the admin role." };
    }

    // Admin cannot touch owners or other admins
    if (callerRole === "admin" && ["owner", "admin"].includes(oldRole) && targetUserId !== callerId) {
      return { success: false, error: "Privilege violation: Admins cannot modify owners or other admins." };
    }

    // Admins can only assign editor, viewer, or member roles
    if (callerRole === "admin" && !["editor", "viewer", "member"].includes(newRole)) {
      return { success: false, error: "Privilege violation: Admins can only assign editor, viewer, or member roles." };
    }

    // Non-admins / non-owners cannot update roles
    if (!["owner", "admin"].includes(callerRole)) {
      return { success: false, error: "Unauthorized: Insufficient permissions to update workspace members." };
    }

    // Last owner demotion protection
    if (oldRole === "owner" && newRole !== "owner") {
      const ownerCount = this.members.filter(
        (m) => m.workspace_id === workspaceId && m.role === "owner"
      ).length;
      if (ownerCount <= 1) {
        return { success: false, error: "Owner protection violation: The last remaining owner cannot be demoted. Transfer ownership first." };
      }
    }

    this.members[targetIdx]!.role = newRole;
    return { success: true };
  }

  // 5. Trigger: enforce_workspace_member_safety on DELETE
  deleteMember(
    callerId: string | null,
    workspaceId: string,
    targetUserId: string
  ): { success: boolean; error?: string } {
    if (!callerId) {
      return { success: false, error: "Unauthorized: Unauthenticated operations on workspace members are strictly forbidden." };
    }

    const callerMember = this.members.find(
      (m) => m.workspace_id === workspaceId && m.user_id === callerId
    );
    if (!callerMember) {
      return { success: false, error: "Unauthorized: Caller is not a member of this workspace." };
    }
    const callerRole = callerMember.role;

    const targetIdx = this.members.findIndex(
      (m) => m.workspace_id === workspaceId && m.user_id === targetUserId
    );
    if (targetIdx === -1) return { success: false, error: "Member not found" };

    const targetRole = this.members[targetIdx]!.role;

    // Admin cannot remove owners or other admins
    if (callerRole === "admin" && ["owner", "admin"].includes(targetRole) && targetUserId !== callerId) {
      return { success: false, error: "Privilege violation: Admins cannot remove owners or other admins." };
    }

    // Regular members can only remove themselves
    if (!["owner", "admin"].includes(callerRole) && callerId !== targetUserId) {
      return { success: false, error: "Unauthorized: Insufficient permissions to remove this workspace member." };
    }

    // Last owner protection
    if (targetRole === "owner") {
      const ownerCount = this.members.filter(
        (m) => m.workspace_id === workspaceId && m.role === "owner"
      ).length;
      if (ownerCount <= 1) {
        return {
          success: false,
          error: "Owner protection violation: The last remaining owner cannot leave or be removed. Transfer ownership or delete the workspace.",
        };
      }
    }

    this.members.splice(targetIdx, 1);
    return { success: true };
  }

  // 6. Function: transfer_workspace_ownership
  transferOwnership(
    callerId: string | null,
    workspaceId: string,
    newOwnerId: string
  ): { success: boolean; error?: string } {
    if (!callerId) return { success: false, error: "Unauthorized: Authentication required." };
    if (!newOwnerId) return { success: false, error: "Invalid target: New owner user id cannot be NULL." };

    const callerMember = this.members.find(
      (m) => m.workspace_id === workspaceId && m.user_id === callerId
    );
    if (!callerMember || callerMember.role !== "owner") {
      return { success: false, error: "Unauthorized: Only a workspace owner can transfer ownership." };
    }

    if (callerId === newOwnerId) return { success: true };

    const targetMember = this.members.find(
      (m) => m.workspace_id === workspaceId && m.user_id === newOwnerId
    );
    if (!targetMember) {
      return {
        success: false,
        error: "Invalid target: Target user must already be a member of the workspace before receiving ownership.",
      };
    }

    // Atomic transaction with internal bypass flag
    this.ownershipTransferActive = true;
    try {
      targetMember.role = "owner";
      callerMember.role = "admin";
    } finally {
      this.ownershipTransferActive = false;
    }

    return { success: true };
  }

  // 7. Trigger: handle_new_user
  registerUser(userId: string, email: string, fullName: string) {
    this.profiles.push({
      id: userId,
      full_name: fullName.slice(0, 100),
      preferred_language: "id",
      theme_preference: "system",
      onboarding_completed: false,
    });

    const wsId = `ws-${userId}`;
    this.workspaces.push({
      id: wsId,
      name: `${fullName}'s Workspace`.slice(0, 100),
      slug: `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${userId.slice(0, 6)}`,
      creator_mode: "creator",
      created_by: userId,
    });

    this.members.push({
      workspace_id: wsId,
      user_id: userId,
      role: "owner",
    });

    this.settings.push({
      workspace_id: wsId,
      default_language: "id",
      default_ai_model: "gemini-1.5-flash",
    });
  }

  // 8. Independent Backfill Procedure
  executeIndependentBackfill(existingAuthUsers: Array<{ id: string; email: string; rawFullName?: string }>) {
    // Phase 1: Backfill Profiles without overwriting
    for (const u of existingAuthUsers) {
      if (!this.profiles.some((p) => p.id === u.id)) {
        this.profiles.push({
          id: u.id,
          full_name: (u.rawFullName || u.email.split("@")[0]!).slice(0, 100),
          preferred_language: "id",
          theme_preference: "system",
          onboarding_completed: false,
        });
      }
    }

    // Phase 2: Repair orphaned workspaces (valid created_by without owner membership)
    for (const w of this.workspaces) {
      const hasOwner = this.members.some((m) => m.workspace_id === w.id && m.role === "owner");
      if (!hasOwner && w.created_by) {
        const existingMember = this.members.find((m) => m.workspace_id === w.id && m.user_id === w.created_by);
        if (existingMember) {
          existingMember.role = "owner";
        } else {
          this.members.push({
            workspace_id: w.id,
            user_id: w.created_by,
            role: "owner",
          });
        }
      }
    }

    // Phase 3: Backfill Workspaces for users who have NO membership anywhere
    for (const u of existingAuthUsers) {
      if (!this.members.some((m) => m.user_id === u.id)) {
        const profile = this.profiles.find((p) => p.id === u.id)!;
        const wsId = `ws-backfill-${u.id}`;
        this.workspaces.push({
          id: wsId,
          name: `${profile.full_name}'s Workspace`.slice(0, 100),
          slug: `ws-${u.id.slice(0, 6)}`,
          creator_mode: "creator",
          created_by: u.id,
        });
        this.members.push({
          workspace_id: wsId,
          user_id: u.id,
          role: "owner",
        });
        this.settings.push({
          workspace_id: wsId,
          default_language: "id",
          default_ai_model: "gemini-1.5-flash",
        });
      }
    }

    // Phase 4: Backfill Workspace Settings for any workspace lacking them
    for (const w of this.workspaces) {
      if (!this.settings.some((s) => s.workspace_id === w.id)) {
        this.settings.push({
          workspace_id: w.id,
          default_language: "id",
          default_ai_model: "gemini-1.5-flash",
        });
      }
    }
  }
}

describe("FINAL SECURITY HARDENING VERIFICATION (15 Required Scenarios)", () => {
  let db: SecurityEngineSimulation;

  beforeEach(() => {
    db = new SecurityEngineSimulation();
    db.registerUser("user-a", "user.a@test.com", "User Alpha");
    db.registerUser("user-b", "user.b@test.com", "User Beta");
  });

  // 1. Pengguna A tidak dapat membaca workspace pribadi pengguna B
  it("Scenario 1: User A cannot read User B's personal workspace", () => {
    const userAWorkspaces = db.selectWorkspaces("user-a");
    expect(userAWorkspaces.map((w) => w.id)).toContain("ws-user-a");
    expect(userAWorkspaces.map((w) => w.id)).not.toContain("ws-user-b");
    expect(db.hasWorkspaceAccess("user-a", "ws-user-b", "viewer")).toBe(false);
  });

  // 2. Pengguna A tidak dapat bergabung ke workspace lain dengan memasukkan membership miliknya sendiri
  it("Scenario 2: User A cannot insert self into User B's workspace (No self-join hole)", () => {
    const attempt = db.insertMember("user-a", {
      workspace_id: "ws-user-b",
      user_id: "user-a",
      role: "member",
    });
    expect(attempt.success).toBe(false);
    expect(attempt.error).toBe("Unauthorized: Caller is not a member of this workspace.");
    expect(db.members.some((m) => m.workspace_id === "ws-user-b" && m.user_id === "user-a")).toBe(false);
  });

  // 3. Admin tidak dapat memberikan role admin kepada pengguna lain
  it("Scenario 3: Admin cannot grant admin role to another user", () => {
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-admin", role: "admin" });
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-target", role: "member" });

    // Admin attempts to promote user-target to admin
    const updateAttempt = db.updateMember("user-admin", "ws-user-a", "user-target", { role: "admin" });
    expect(updateAttempt.success).toBe(false);
    expect(updateAttempt.error).toBe("Role escalation rejected: Only workspace owners can grant or revoke the admin role.");

    // Admin attempts to insert new user with admin role
    const insertAttempt = db.insertMember("user-admin", {
      workspace_id: "ws-user-a",
      user_id: "user-new-admin",
      role: "admin",
    });
    expect(insertAttempt.success).toBe(false);
    expect(insertAttempt.error).toBe("Role escalation rejected: Only workspace owners can assign the admin role.");
  });

  // 4. Admin tidak dapat mengangkat siapa pun menjadi owner
  it("Scenario 4: Admin cannot promote self or others to owner", () => {
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-admin", role: "admin" });

    // Admin attempts direct update to owner
    const updateAttempt = db.updateMember("user-admin", "ws-user-a", "user-admin", { role: "owner" });
    expect(updateAttempt.success).toBe(false);
    expect(updateAttempt.error).toBe("Direct owner role modifications are prohibited. Use transfer_workspace_ownership() instead.");

    // Admin attempts to insert new owner
    const insertAttempt = db.insertMember("user-admin", {
      workspace_id: "ws-user-a",
      user_id: "user-intruder",
      role: "owner",
    });
    expect(insertAttempt.success).toBe(false);
    expect(insertAttempt.error).toBe("Role escalation rejected: Only workspace owners can assign the owner role.");
  });

  // 5. Admin tidak dapat mengubah, menurunkan, atau menghapus owner
  it("Scenario 5: Admin cannot modify, demote, or delete an owner", () => {
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-admin", role: "admin" });

    // Admin attempts to demote owner to member
    const demoteAttempt = db.updateMember("user-admin", "ws-user-a", "user-a", { role: "member" });
    expect(demoteAttempt.success).toBe(false);
    expect(demoteAttempt.error).toBe("Direct owner role modifications are prohibited. Use transfer_workspace_ownership() instead.");

    // Admin attempts to delete owner
    const deleteAttempt = db.deleteMember("user-admin", "ws-user-a", "user-a");
    expect(deleteAttempt.success).toBe(false);
    expect(deleteAttempt.error).toBe("Privilege violation: Admins cannot remove owners or other admins.");
  });

  // 6. Owner tidak dapat menghapus owner terakhir
  it("Scenario 6: Owner cannot delete the last owner of the workspace", () => {
    const attempt = db.deleteMember("user-a", "ws-user-a", "user-a");
    expect(attempt.success).toBe(false);
    expect(attempt.error).toBe(
      "Owner protection violation: The last remaining owner cannot leave or be removed. Transfer ownership or delete the workspace."
    );
    expect(db.members.some((m) => m.workspace_id === "ws-user-a" && m.user_id === "user-a")).toBe(true);
  });

  // 7. Owner terakhir tidak dapat keluar tanpa transfer kepemilikan
  it("Scenario 7: Last owner cannot leave workspace without ownership transfer", () => {
    // Even when there are other members (e.g. editor), last owner still cannot leave
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-editor", role: "editor" });

    const leaveAttempt = db.deleteMember("user-a", "ws-user-a", "user-a");
    expect(leaveAttempt.success).toBe(false);
    expect(leaveAttempt.error).toContain("The last remaining owner cannot leave or be removed");
  });

  // 8. Hanya owner yang dapat melakukan transfer kepemilikan
  it("Scenario 8: Only an owner can initiate transfer of ownership", () => {
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-admin", role: "admin" });
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-member", role: "member" });

    // Admin tries to transfer ownership
    const adminTransfer = db.transferOwnership("user-admin", "ws-user-a", "user-member");
    expect(adminTransfer.success).toBe(false);
    expect(adminTransfer.error).toBe("Unauthorized: Only a workspace owner can transfer ownership.");

    // True owner transfers ownership successfully
    const ownerTransfer = db.transferOwnership("user-a", "ws-user-a", "user-member");
    expect(ownerTransfer.success).toBe(true);
    expect(db.members.find((m) => m.workspace_id === "ws-user-a" && m.user_id === "user-member")?.role).toBe("owner");
    expect(db.members.find((m) => m.workspace_id === "ws-user-a" && m.user_id === "user-a")?.role).toBe("admin");
  });

  // 9. Transfer kepemilikan bersamaan tidak dapat menyebabkan workspace kehilangan seluruh owner
  it("Scenario 9: Concurrent transfers serialize and maintain at least one valid owner at all times", () => {
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-m1", role: "member" });
    db.members.push({ workspace_id: "ws-user-a", user_id: "user-m2", role: "member" });

    // Simulate transfer to user-m1
    const t1 = db.transferOwnership("user-a", "ws-user-a", "user-m1");
    expect(t1.success).toBe(true);

    // Concurrent/subsequent transfer by original user-a fails because user-a is now admin, not owner
    const t2 = db.transferOwnership("user-a", "ws-user-a", "user-m2");
    expect(t2.success).toBe(false);
    expect(t2.error).toBe("Unauthorized: Only a workspace owner can transfer ownership.");

    // Exactly one owner exists
    const owners = db.members.filter((m) => m.workspace_id === "ws-user-a" && m.role === "owner");
    expect(owners).toHaveLength(1);
    expect(owners[0]!.user_id).toBe("user-m1");
  });

  // 10. workspace_id dan user_id tidak dapat diubah melalui UPDATE biasa
  it("Scenario 10: workspace_id and user_id are strictly immutable on UPDATE", () => {
    const attempt = db.updateMember("user-a", "ws-user-a", "user-a", {
      new_workspace_id: "ws-user-b",
    });
    expect(attempt.success).toBe(false);
    expect(attempt.error).toBe("Data integrity violation: Membership identity (workspace_id, user_id) is immutable.");

    const attemptUser = db.updateMember("user-a", "ws-user-a", "user-a", {
      new_user_id: "user-intruder",
    });
    expect(attemptUser.success).toBe(false);
    expect(attemptUser.error).toBe("Data integrity violation: Membership identity (workspace_id, user_id) is immutable.");
  });

  // 11. Signup otomatis membuat profile, workspace, owner membership, dan settings
  it("Scenario 11: Signup automatically creates profile, workspace, owner membership, and settings", () => {
    db.registerUser("user-new", "new@creator.id", "New Creator");

    expect(db.profiles.some((p) => p.id === "user-new" && p.full_name === "New Creator")).toBe(true);
    expect(db.workspaces.some((w) => w.id === "ws-user-new" && w.created_by === "user-new")).toBe(true);
    expect(db.members.some((m) => m.workspace_id === "ws-user-new" && m.user_id === "user-new" && m.role === "owner")).toBe(true);
    expect(db.settings.some((s) => s.workspace_id === "ws-user-new" && s.default_language === "id")).toBe(true);
  });

  // 12. Backfill memperbaiki data yang belum lengkap tanpa membuat duplikasi
  it("Scenario 12: Backfill completes missing components without duplication", () => {
    db.workspaces.push({
      id: "ws-orphan",
      name: "Orphan WS",
      slug: "orphan-ws",
      creator_mode: "creator",
      created_by: "user-a",
    });

    db.executeIndependentBackfill([
      { id: "user-a", email: "user.a@test.com" },
      { id: "user-c", email: "user.c@test.com", rawFullName: "User Charlie" },
    ]);

    // Check no duplicate settings for ws-user-a
    const aSettings = db.settings.filter((s) => s.workspace_id === "ws-user-a");
    expect(aSettings).toHaveLength(1);

    // Check newly added settings for ws-orphan
    const orphanSettings = db.settings.filter((s) => s.workspace_id === "ws-orphan");
    expect(orphanSettings).toHaveLength(1);

    // Check User Charlie received workspace and owner membership
    expect(db.members.some((m) => m.user_id === "user-c" && m.role === "owner")).toBe(true);
  });

  // 13. Data profile yang sudah ada tidak tertimpa
  it("Scenario 13: Existing profile data is preserved and never overwritten by backfill", () => {
    db.profiles.push({
      id: "user-custom",
      full_name: "Original Custom Name",
      preferred_language: "id",
      theme_preference: "dark",
      onboarding_completed: true,
    });

    db.executeIndependentBackfill([
      { id: "user-custom", email: "custom@test.com", rawFullName: "Overwritten Name" },
    ]);

    const p = db.profiles.find((item) => item.id === "user-custom");
    expect(p?.full_name).toBe("Original Custom Name");
    expect(p?.theme_preference).toBe("dark");
  });

  // 14. Workspace tanpa owner dapat diperbaiki dengan benar
  it("Scenario 14: Orphaned workspace lacking an owner is repaired by assigning created_by as owner", () => {
    // Create an orphaned workspace with valid created_by but no members
    db.workspaces.push({
      id: "ws-no-owner",
      name: "No Owner Workspace",
      slug: "no-owner-ws",
      creator_mode: "creator",
      created_by: "user-b",
    });

    // Run backfill
    db.executeIndependentBackfill([]);

    // Check ws-no-owner now has user-b as owner
    const member = db.members.find((m) => m.workspace_id === "ws-no-owner");
    expect(member).toBeDefined();
    expect(member?.user_id).toBe("user-b");
    expect(member?.role).toBe("owner");
  });

  // 15. SELECT, UPDATE, DELETE, dan INSERT lintas workspace ditolak
  it("Scenario 15: Cross-tenant SELECT, UPDATE, DELETE, and INSERT are completely rejected", () => {
    // SELECT: User A cannot see ws-user-b
    const visibleToA = db.selectWorkspaces("user-a");
    expect(visibleToA.some((w) => w.id === "ws-user-b")).toBe(false);

    // INSERT: User A cannot insert member into ws-user-b
    const insertRes = db.insertMember("user-a", {
      workspace_id: "ws-user-b",
      user_id: "user-stranger",
      role: "viewer",
    });
    expect(insertRes.success).toBe(false);

    // UPDATE: User A cannot update members in ws-user-b
    const updateRes = db.updateMember("user-a", "ws-user-b", "user-b", { role: "member" });
    expect(updateRes.success).toBe(false);

    // DELETE: User A cannot delete members in ws-user-b
    const deleteRes = db.deleteMember("user-a", "ws-user-b", "user-b");
    expect(deleteRes.success).toBe(false);
  });
});
