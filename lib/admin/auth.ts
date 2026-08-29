import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_EMAILS = [
  "n.adams3@icloud.com",
  "nicosmada3@googlemail.com",
  "nick@back2strong.online",
];

const ACCESS_COOKIE = "b2s_admin_session";

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
// Note middleware.ts already gates /api/admin/* on this same cookie, so this
// is defence in depth rather than the only lock.
export async function isAuthorisedAdmin(): Promise<boolean> {
  const accessKey = process.env.ADMIN_ACCESS_KEY;
  if (accessKey) {
    const cookieValue = cookies().get(ACCESS_COOKIE)?.value;
    if (cookieValue === accessKey) return true;
  }

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return true;
  } catch {
    // No session / cookie store unavailable — fall through to false.
  }

  // If no ADMIN_ACCESS_KEY is configured at all, the deployment is still in the
  // pre-gate "open" state; don't lock the coach out of his own buttons.
  if (!accessKey) return true;

  return false;
}
