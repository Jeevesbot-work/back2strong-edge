import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminViewer } from "@/lib/admin/auth";
import { APPROVAL_REQUIRED_MESSAGE } from "@/lib/ai/limits";

type ServerClient = ReturnType<typeof createClient>;

export type ClientAccess =
  | { ok: true; userId: string; email: string; isAdmin: boolean; supabase: ServerClient }
  | { ok: false; response: NextResponse };

/** Signed-in approved client, or an admin. Unapproved sessions get 403. */
export async function requireActiveClient(): Promise<ClientAccess> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  }

  const isAdmin = await isAdminViewer(user.email);
  if (isAdmin) {
    return { ok: true, userId: user.id, email: user.email ?? "", isAdmin: true, supabase };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[access] could not read profile approval:", error.message);
    return {
      ok: false,
      response: NextResponse.json({ error: "Couldn't check your account. Try again." }, { status: 500 }),
    };
  }

  if (!profile?.approved) {
    return {
      ok: false,
      response: NextResponse.json({ error: APPROVAL_REQUIRED_MESSAGE }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, email: user.email ?? "", isAdmin: false, supabase };
}
