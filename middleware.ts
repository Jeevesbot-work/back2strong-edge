import { NextRequest, NextResponse } from "next/server";

// Private-link gate for the coach admin area — replaces the old
// REQUIRE_ADMIN_LOGIN=false "wide open" state with a no-password approach:
// only someone who has the secret bookmark link (or the cookie it sets) can
// reach /admin or /api/admin. No login form, nothing to remember day to day.
//
// Setup (one-time): set ADMIN_ACCESS_KEY in the Vercel project's environment
// variables to a long random string. Then the coach's one-time bootstrap URL
// is:  https://app.back2strong.online/admin?key=THAT_STRING
// Visiting it sets a 1-year cookie and redirects to the clean /admin URL.
// Bookmark /admin after that — the cookie does the rest.

const COOKIE_NAME = "b2s_admin_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const accessKey = process.env.ADMIN_ACCESS_KEY;

  // If no key is configured, don't lock the founder out — just pass through.
  // (Set ADMIN_ACCESS_KEY in Vercel to turn the gate on.)
  if (!accessKey) return NextResponse.next();

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieValue === accessKey) return NextResponse.next();

  const keyParam = searchParams.get("key");
  if (keyParam === accessKey) {
    // Correct key in the URL — set the cookie and redirect to the clean path
    // so the secret never sits in browser history or gets shared by accident.
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("key");
    const res = NextResponse.redirect(cleanUrl);
    res.cookies.set(COOKIE_NAME, accessKey, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: ONE_YEAR,
      path: "/",
    });
    return res;
  }

  // No valid cookie or key — pretend this doesn't exist rather than showing
  // a login page (a 404 gives a stranger nothing to probe).
  return new NextResponse("Not found", { status: 404 });
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
