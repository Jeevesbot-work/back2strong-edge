import { ADMIN_EMAILS } from "@/lib/admin/gate";

/** Existing admin preview cookie. View-as-client reuses it. It is not a client session. */
export const PREVIEW_COOKIE = "preview_user_id";

export const VIEW_READONLY_ERROR = "Viewing as a client is read-only.";
export const VIEW_READONLY_STATUS = 403;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PreviewProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  is_test?: boolean | null;
  approved?: boolean | null;
};

export type PreviewStartDecision =
  | { ok: true; clientId: string; name: string }
  | { ok: false; status: 401 | 400 | 404; error: string };

/**
 * A profile Nick may open in the client app. Test accounts and coach logins
 * are not clients. Missing rows are not clients. Approval is not required:
 * a real pending profile is still that person's app.
 */
export function isPreviewableClient(
  profile: PreviewProfile | null | undefined,
  adminEmails: readonly string[] = ADMIN_EMAILS,
): boolean {
  if (!profile?.id || !UUID.test(profile.id)) return false;
  if (profile.is_test === true) return false;
  const email = String(profile.email ?? "").toLowerCase();
  if (email && adminEmails.some((admin) => admin.toLowerCase() === email)) return false;
  return true;
}

/** Whether POST /api/admin/set-preview may set the preview cookie. */
export function previewStartDecision(input: {
  isAdmin: boolean;
  userId: unknown;
  profile: PreviewProfile | null;
  adminEmails?: readonly string[];
}): PreviewStartDecision {
  if (!input.isAdmin) return { ok: false, status: 401, error: "Unauthorised" };
  if (typeof input.userId !== "string" || !UUID.test(input.userId)) {
    return { ok: false, status: 400, error: "Choose a client to view." };
  }
  if (!input.profile || input.profile.id !== input.userId || !isPreviewableClient(input.profile, input.adminEmails)) {
    return { ok: false, status: 404, error: "That profile can't be viewed." };
  }
  const name = input.profile.full_name?.trim() || "Client";
  return { ok: true, clientId: input.userId, name };
}

/** Client-app writes, AI calls, and side effects while an admin is viewing. */
export function clientWriteDecision(previewing: boolean): { ok: true } | { ok: false; status: 403; error: string } {
  if (previewing) return { ok: false, status: VIEW_READONLY_STATUS, error: VIEW_READONLY_ERROR };
  return { ok: true };
}

const MUTATION = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Blanket server gate. An admin with the preview cookie cannot call a
 * mutating client API. Non-admins are ignored even if they send the cookie.
 * Admin, cron, and auth routes stay available so Exit and sign-in still work.
 */
export function clientMutationDecision(input: {
  method: string;
  pathname: string;
  previewId: string | undefined | null;
  isAdmin: boolean;
}): { block: false } | { block: true; status: 403; error: string } {
  if (!MUTATION.has(input.method.toUpperCase())) return { block: false };
  if (!input.isAdmin) return { block: false };
  if (!input.previewId || !UUID.test(input.previewId)) return { block: false };
  const path = input.pathname;
  if (path.startsWith("/api/admin")) return { block: false };
  if (path.startsWith("/api/cron")) return { block: false };
  if (path.startsWith("/api/auth")) return { block: false };
  if (!path.startsWith("/api/")) return { block: false };
  return { block: true, status: VIEW_READONLY_STATUS, error: VIEW_READONLY_ERROR };
}
