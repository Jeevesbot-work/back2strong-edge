import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Swaps a valid invite for a fresh one-time sign-in token. Called by the
// /welcome page only when the client taps "Sign in", never on page load.
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") return NextResponse.json({ error: "invalid" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: invite } = await admin.from("login_invites").select("id, email, expires_at, revoked, uses").eq("token", token).maybeSingle();
  if (!invite || invite.revoked || new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: invite.email });
  if (error || !data?.properties?.hashed_token) return NextResponse.json({ error: "failed" }, { status: 500 });
  await admin.from("login_invites").update({ uses: invite.uses + 1, last_used_at: new Date().toISOString() }).eq("id", invite.id);
  return NextResponse.json({ token_hash: data.properties.hashed_token, type: data.properties.verification_type ?? "magiclink" });
}
