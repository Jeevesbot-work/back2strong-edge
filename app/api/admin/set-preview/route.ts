import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { PREVIEW_COOKIE, previewStartDecision } from "@/lib/view-as";
import { readPreviewProfile, recordClientView } from "@/lib/view-as-server";

const HOUR = 60 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

// Opens the existing admin preview. Does not create a client session, magic
// link, or auth token. The browser keeps the admin's own session. Later reads
// are server-side and scoped to this client id, and only after is_admin.
export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: { userId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const profile = typeof body.userId === "string" ? await readPreviewProfile(body.userId) : null;
  const decision = previewStartDecision({ isAdmin: true, userId: body.userId, profile });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await recordClientView(user?.id ?? null, decision.clientId);

  const res = NextResponse.json({ ok: true, name: decision.name });
  res.cookies.set(PREVIEW_COOKIE, decision.clientId, cookieOptions(HOUR));
  return res;
}

export async function DELETE() {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PREVIEW_COOKIE, "", cookieOptions(0));
  return res;
}
