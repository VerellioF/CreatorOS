import { describe, it, expect } from "vitest";

describe("Workspace Authorization Role Hierarchy", () => {
  const roleHierarchy: Record<string, number> = {
    viewer: 1,
    member: 1,
    editor: 2,
    admin: 3,
    owner: 4,
  };

  function hasAccess(userRole: string, requiredRole: string): boolean {
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 1;
    return userLevel >= requiredLevel;
  }

  it("grants owner access to all operations", () => {
    expect(hasAccess("owner", "viewer")).toBe(true);
    expect(hasAccess("owner", "editor")).toBe(true);
    expect(hasAccess("owner", "admin")).toBe(true);
    expect(hasAccess("owner", "owner")).toBe(true);
  });

  it("grants admin access to admin, editor, and viewer operations, but not owner", () => {
    expect(hasAccess("admin", "viewer")).toBe(true);
    expect(hasAccess("admin", "editor")).toBe(true);
    expect(hasAccess("admin", "admin")).toBe(true);
    expect(hasAccess("admin", "owner")).toBe(false);
  });

  it("restricts editor from administrative operations", () => {
    expect(hasAccess("editor", "viewer")).toBe(true);
    expect(hasAccess("editor", "editor")).toBe(true);
    expect(hasAccess("editor", "admin")).toBe(false);
    expect(hasAccess("editor", "owner")).toBe(false);
  });

  it("restricts viewer to read-only operations", () => {
    expect(hasAccess("viewer", "viewer")).toBe(true);
    expect(hasAccess("viewer", "editor")).toBe(false);
    expect(hasAccess("viewer", "admin")).toBe(false);
  });

  it("rejects unknown roles", () => {
    expect(hasAccess("guest", "viewer")).toBe(false);
  });
});
