import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE, configuredAdminKey, decideAdminGate } from "@/lib/admin/gate";

// Private-link gate for the coach admin area.
// A configured ADMIN_ACCESS_KEY lets the coach's bookmark cookie (or ?key=)
// open /admin. A signed-in admin email also opens it, and when the key is set
// that session stores the same cookie.
//
// A missing ADMIN_ACCESS_KEY does not open the gate. Anonymous requests to
// /admin and /api/admin are 404. The client app on / stays public.
//
// Setup: set ADMIN_ACCESS_KEY in the Vercel project's environment variables
// to a long random string. The coach's one-time bootstrap URL is:
//   https://app.back2strong.online/admin?key=THAT_STRING
// Visiting it sets a 1-year cookie and redirects to the clean /admin URL.

const ONE_YEAR = 60 * 60 * 24 * 365;

function withAdminCookie(res: NextResponse, accessKey: string) {
  res.cookies.set(ADMIN_COOKIE, accessKey, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const accessKey = configuredAdminKey(process.env.ADMIN_ACCESS_KEY);
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const keyParam = searchParams.get("key");

  let email: string | null = null;
  const cookieOk = !!accessKey && cookie === accessKey;
  const keyParamOk = !!accessKey && keyParam === accessKey;
  if (!cookieOk && !keyParamOk) {
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
      );
      const { data: { user } } = await supabase.auth.getUser();
      email = user?.email ?? null;
    } catch {
      // Supabase unreachable — fall through. A matching cookie was already handled.
    }
  }

  const decision = decideAdminGate({
    pathname,
    accessKey,
    cookie,
    keyParam,
    stay: searchParams.get("stay") === "1",
    email,
  });

  if (decision.kind === "deny") {
    return new NextResponse("Not found", { status: decision.status });
  }

  if (decision.kind === "public") return NextResponse.next();

  const stamp = (res: NextResponse) => (
    decision.setCookie && accessKey ? withAdminCookie(res, accessKey) : res
  );

  if (decision.kind === "rewrite") {
    const target = req.nextUrl.clone();
    target.pathname = "/admin";
    return stamp(NextResponse.rewrite(target));
  }

  if (decision.kind === "redirect") {
    const url = req.nextUrl.clone();
    url.pathname = decision.pathname;
    if (decision.clearSearch) url.search = "";
    else if (decision.stripKey) url.searchParams.delete("key");
    return stamp(NextResponse.redirect(url));
  }

  return stamp(NextResponse.next());
}

export const config = {
  matcher: ["/", "/admin", "/admin/:path*", "/api/admin/:path*"],
};
