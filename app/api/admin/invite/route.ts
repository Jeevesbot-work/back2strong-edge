import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { createClientInvite, parseInviteRequest, type InviteStore } from "@/lib/clients/invite";

// Name and email in, a copyable 7-day welcome link out.
// This route does not email the client. Nick sends the link himself.
// It does not attach a programme. Assigning one is a separate step.
export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "App URL is not configured" }, { status: 500 });
  }

  const parsed = parseInviteRequest(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const store: InviteStore = {
    async createUser(email) {
      // createUser does not send mail. email_confirm lets the welcome link sign them in.
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (data?.user?.id) return { id: data.user.id };
      return { error: { message: error?.message, code: error?.code } };
    },
    async findUserId(email) {
      // generateLink does not send mail. The magic link it returns is discarded.
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error || !data.user?.id) return null;
      return data.user.id;
    },
    async readProfile(userId) {
      const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      return data ? { full_name: data.full_name } : null;
    },
    async writeProfile(userId, fields) {
      const { error } = await admin.from("profiles").upsert({ id: userId, ...fields });
      return error?.message ?? null;
    },
    async hasProgrammeState(userId) {
      const { data } = await admin.from("programme_state").select("user_id").eq("user_id", userId).maybeSingle();
      return !!data;
    },
    async insertProgrammeState(userId, state) {
      const { error } = await admin.from("programme_state").insert({ user_id: userId, ...state });
      return error?.message ?? null;
    },
    async replaceInvite(email, token) {
      const revoked = await admin.from("login_invites").update({ revoked: true }).eq("email", email).eq("revoked", false);
      if (revoked.error) return revoked.error.message;
      // expires_at stays the table default: 7 days.
      const inserted = await admin.from("login_invites").insert({ token, email });
      return inserted.error?.message ?? null;
    },
  };

  const token = randomBytes(24).toString("base64url");
  const result = await createClientInvite(store, {
    fullName: parsed.fullName,
    email: parsed.email,
    token,
    appUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    userId: result.userId,
    link: result.link,
    fullName: result.fullName,
    email: result.email,
    emailed: false,
  });
}
