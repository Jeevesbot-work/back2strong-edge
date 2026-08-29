import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const ADMINS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

// One atomic onboard: auth user + profile + programme_state + client_programmes,
// in the right order, then a best-effort welcome email. The magic link is ALWAYS
// returned so Nick can send it via WhatsApp even if email delivery fails.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const { email, full_name, age, goal, training_state, injuries, days_per_week, programme, sessions, auditId } = body;

  if (!email || !full_name) {
    return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
  }
  if (!programme || !sessions) {
    return NextResponse.json({ error: "Programme not generated yet — generate it before saving" }, { status: 400 });
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Creates the auth user if new, returns their id + a one-time login link.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkError?.message ?? "Failed to create login link" }, { status: 500 });
  }

  const userId = linkData.user.id;
  // PKCE-independent verification link (see /api/auth/login for why).
  const tokenHash = linkData.properties.hashed_token;
  const verificationType = linkData.properties.verification_type ?? "magiclink";
  const magicLink = `${APP_URL}/auth/callback?token_hash=${tokenHash}&type=${verificationType}`;
  const firstName = String(full_name).split(" ")[0];

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    full_name,
    age: age ? parseInt(String(age)) : null,
    goal: goal || null,
    training_state: training_state || null,
    injuries: injuries || null,
    days_per_week: days_per_week ?? 3,
    approved: true,
  });
  if (profileError) {
    return NextResponse.json({ error: `Profile: ${profileError.message}` }, { status: 500 });
  }

  const { error: stateError } = await admin.from("programme_state").upsert(
    { user_id: userId, current_day: 1, current_week: 1 },
    { onConflict: "user_id" }
  );
  if (stateError) {
    return NextResponse.json({ error: `State: ${stateError.message}` }, { status: 500 });
  }

  // THE step that the old add-client flow skipped — attach the programme in the
  // same transaction so the client never lands on "awaiting programme".
  const { error: progError } = await admin.from("client_programmes").upsert(
    { user_id: userId, programme, sessions },
    { onConflict: "user_id" }
  );
  if (progError) {
    return NextResponse.json({ error: `Programme: ${progError.message}` }, { status: 500 });
  }

  // Mark the source audit as onboarded so it drops out of the "new" inbox.
  if (auditId) {
    await admin.from("coach_notes").update({ tag: "audit:onboarded" }).eq("id", auditId);
  }

  // Best-effort email. Never blocks onboarding — the link is returned regardless.
  let emailSent = false;
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nick Adams · Back2Strong <nick@back2strong.online>",
        to: email,
        subject: "You're in. Your Edge access is ready.",
        html: `
          <div style="background:#0E1014;padding:48px 32px;font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border-radius:16px;">
            <p style="color:#9BA3AF;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 24px;">Back2Strong · Edge</p>
            <p style="color:#F2F1ED;font-size:28px;font-family:Georgia,serif;font-weight:400;margin:0 0 16px;line-height:1.2;">You're in, ${firstName}.</p>
            <p style="color:rgba(242,241,237,0.55);font-size:14px;margin:0 0 32px;line-height:1.6;">Your programme is set up and waiting. Tap below to open Edge. This link is one-time and expires soon — if you miss it, request a fresh one from the login screen.</p>
            <a href="${magicLink}" style="display:block;background:#C8965A;border-radius:12px;padding:14px 24px;text-decoration:none;text-align:center;color:#0E1014;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">Open Edge →</a>
          </div>`,
      }),
    });
    emailSent = resendRes.ok;
  } catch {
    emailSent = false;
  }

  return NextResponse.json({ ok: true, userId, magicLink, emailSent });
}
