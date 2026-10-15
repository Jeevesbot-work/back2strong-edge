import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolveActingClient } from "@/lib/acting-client";

// Returns the effective programme for the signed-in user.
// When an admin is in preview mode (preview_user_id cookie), returns the
// previewed client's programme instead — same as the server-rendered pages.
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { targetId, previewing } = await resolveActingClient(user.id, user.email);
  const db = previewing ? createAdminClient() : supabase;
  const { data } = await db
    .from("client_programmes")
    .select("programme, sessions")
    .eq("user_id", targetId)
    .maybeSingle();

  return NextResponse.json({
    programme: data?.programme ?? null,
    sessions: data?.sessions ?? {},
  });
}
