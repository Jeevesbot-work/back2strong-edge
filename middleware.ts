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
  const isRoot = pathname === "/";

  // If no key is configured, don't lock the founder out — just pass through.
  // (Set ADMIN_ACCESS_KEY in Vercel to turn the gate on.)
  if (!accessKey) return NextResponse.next();

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieValue === accessKey) {
    // Recognised coach device landing on the front door — send them straight to
    // the Command Centre. Means a plain bookmark of the bare domain opens the
    // dashboard rather than the client-facing app, so there's only ever one
    // address to remember.
    if (isRoot) {
      const adminUrl = req.nextUrl.clone();
      adminUrl.pathname = "/admin";
      adminUrl.search = "";
      return NextResponse.redirect(adminUrl);
    }
    return NextResponse.next();
  }

  const keyParam = searchParams.get("key");
  if (keyParam === accessKey) {
    const setCookie = (res: NextResponse) => {
      res.cookies.set(COOKIE_NAME, accessKey, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: ONE_YEAR,
        path: "/",
      });
      return res;
    };

    // "stay=1" — serve the dashboard WITHOUT redirecting, so the key remains in
    // the address bar. This exists for iOS "Add to Home Screen": a saved web app
    // can keep its own cookie store separate from Safari's, so a cookie alone
    // isn't dependable there. Keeping the key in the saved URL means the icon
    // re-authorises itself on every launch and can never fall out of access.
    if (searchParams.get("stay") === "1") {
      if (isRoot) {
        const target = req.nextUrl.clone();
        target.pathname = "/admin";
        // Rewrite, not redirect: the browser keeps showing the original URL
        // (key intact) while being served the Command Centre.
        return setCookie(NextResponse.rewrite(target));
      }
      return setCookie(NextResponse.next());
    }

    // Normal desktop path: set the cookie and redirect to the clean URL so the
    // secret never lingers in browser history or gets shared by accident.
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("key");
    // Arriving at the bare domain with the key should land on the dashboard,
    // not the client app front page.
    if (isRoot) cleanUrl.pathname = "/admin";
    return setCookie(NextResponse.redirect(cleanUrl));
  }

  // The bare domain must stay public — it's the clients' app. Only the admin
  // paths get hidden.
  if (isRoot) return NextResponse.next();

  // No valid cookie or key — pretend this doesn't exist rather than showing
  // a login page (a 404 gives a stranger nothing to probe).
  return new NextResponse("Not found", { status: 404 });
}

export const config = {
  matcher: ["/", "/admin", "/admin/:path*", "/api/admin/:path*"],
};
