import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// Admin-only: creates a 7-day sign-in invite for a client and returns its link,
// so Nick can send it by WhatsApp. The link survives WhatsApp previews (sign-in
// needs a tap) and can be reused on the client's devices until it expires.
export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const clean = String(email).trim().toLowerCase();
  const token = randomBytes(24).toString("base64url");
  // A new invite replaces any older ones for this client.
  await admin.from("login_invites").update({ revoked: true }).eq("email", clean).eq("revoked", false);
  const { error } = await admin.from("login_invites").insert({ token, email: clean });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: `${APP_URL}/welcome/${token}` });
}
