import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const { email, full_name, age, goal, training_state, injuries, days_per_week } = body;

  if (!email || !full_name) {
    return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // generateLink creates the auth user if they don't exist and returns their ID
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkError?.message ?? "Failed to generate link" }, { status: 500 });
  }

  const userId = linkData.user.id;
  const magicLink = linkData.properties.action_link;
  const firstName = full_name.split(" ")[0];

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    email,
    full_name,
    age: age ? parseInt(age) : null,
    goal: goal || null,
    training_state: training_state || null,
    injuries: injuries || null,
    days_per_week: days_per_week ?? 3,
    approved: true,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Create programme_state so the programme can advance over time
  await adminClient.from("programme_state").upsert({
    user_id: userId,
    current_day: 1,
    current_week: 1,
  }, { onConflict: "user_id" });

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
          <p style="color:rgba(242,241,237,0.55);font-size:14px;margin:0 0 8px;line-height:1.6;">Nick has set up your programme. Click below to open Edge.</p>
          <p style="color:rgba(242,241,237,0.35);font-size:13px;margin:0 0 32px;line-height:1.6;">This link expires in 2 hours and can only be used once. If you miss it, you can request a new one from the login screen.</p>
          <a href="${magicLink}" style="display:block;background:#C8965A;border-radius:12px;padding:14px 24px;text-decoration:none;text-align:center;color:#0E1014;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">Open Edge →</a>
          <p style="color:#3D434D;font-size:11px;margin:24px 0 0;text-align:center;">If you didn't expect this, ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.message ?? "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId });
}
