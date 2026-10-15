import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_COOKIE, ADMIN_EMAILS, adminSessionAllowed, configuredAdminKey } from "@/lib/admin/gate";

export { ADMIN_EMAILS };

// Authorises a coach-side admin API request.
//
// Two accepted proofs, either is sufficient:
//  1. A Supabase session whose email is in ADMIN_EMAILS (the original path,
//     still works if Nick happens to be logged in).
//  2. The private-link cookie set by middleware.ts. Since the coach now opens
//     the Command Centre from a bookmarked secret link rather than logging in,
//     this is the normal everyday path — without it, every admin action button
//     (message client, approve, add task…) would 401 for the one person who
//     is supposed to be able to press them.
//
// A missing ADMIN_ACCESS_KEY does not authorise anyone. The cookie only counts
// when it matches a configured key. Otherwise the caller must be signed in
// with an admin email.
export async function isAuthorisedAdmin(): Promise<boolean> {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  const cookieValue = cookies().get(ADMIN_COOKIE)?.value;
  const key = configuredAdminKey(accessKey);
  if (key && cookieValue === key) return true;

  let email: string | null = null;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? null;
  } catch {
    email = null;
  }

  return adminSessionAllowed({ accessKey, cookie: cookieValue, email });
}

/** Server pages under /admin. Missing proof is a 404, same as the middleware. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAuthorisedAdmin())) notFound();
}

/**
 * A real admin: the private-link cookie, or a signed-in admin email.
 * A missing access key does not make everyone an admin.
 * Use this before honouring the client-preview cookie or skipping an approval check
 * on a route a client can call.
 */
export async function isAdminViewer(email?: string | null): Promise<boolean> {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  if (accessKey && cookies().get(ADMIN_COOKIE)?.value === accessKey) return true;

  let resolved = email;
  if (resolved === undefined) {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      resolved = user?.email ?? null;
    } catch {
      resolved = null;
    }
  }

  if (!resolved) return false;
  return ADMIN_EMAILS.includes(resolved) || ADMIN_EMAILS.includes(resolved.toLowerCase());
}
