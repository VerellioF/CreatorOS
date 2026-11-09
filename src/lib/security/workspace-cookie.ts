import { cookies } from "next/headers";
import { isValidUuid } from "./sanitize";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";
const WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Reads and validates the `active_workspace_id` cookie on the server.
 * Malformed or non-UUID values are discarded immediately.
 */
export async function getValidatedActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (!isValidUuid(rawValue)) {
    return null;
  }
  return rawValue.trim();
}

export const getVerifiedWorkspaceIdFromCookie = getValidatedActiveWorkspaceId;

/**
 * Persists the verified `active_workspace_id` in an `HttpOnly`, `SameSite=Lax` cookie
 * (`Secure` enabled automatically in production).
 */
export async function setActiveWorkspaceCookie(workspaceId: string): Promise<void> {
  if (!isValidUuid(workspaceId)) {
    throw new Error("Invalid workspace ID for cookie persistence");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Clears the `active_workspace_id` cookie on sign-out or workspace removal.
 */
export async function clearActiveWorkspaceCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}
