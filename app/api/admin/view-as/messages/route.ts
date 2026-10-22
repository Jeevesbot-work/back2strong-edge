import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { resolveActingClient } from "@/lib/acting-client";

// Read the viewed client's coach thread. Select only: no read receipt, no
// notification, no assistant reply.
export async function GET() {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ viewing: false }, { status: 401 });

  const view = await resolveActingClient(user.id, user.email);
  if (!view.previewing) return NextResponse.json({ viewing: false });

  const db = createAdminClient();
  const { data } = await db
    .from("messages")
    .select("id, role, content, created_at")
    .eq("user_id", view.targetId)
    .order("created_at", { ascending: true })
    .limit(50);

  return NextResponse.json({
    viewing: true,
    name: view.name,
    messages: data ?? [],
  });
}
