import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// Admin-only: returns a one-time sign-in link for a client WITHOUT emailing it,
// so Nick can send it by WhatsApp. Same PKCE-independent link as /api/auth/login.
export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? "Couldn't create a link" }, { status: 500 });
  }
  const type = data.properties.verification_type ?? "magiclink";
  return NextResponse.json({ link: `${APP_URL}/auth/callback?token_hash=${data.properties.hashed_token}&type=${type}` });
}
