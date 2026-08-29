import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const ADMIN_EMAILS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

// Sends a message from Nick into the client's Edge chat.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { userId, content } = await req.json();
  if (!userId || !content?.trim()) {
    return NextResponse.json({ error: "userId and content required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .insert({ user_id: userId, role: "assistant", content: content.trim() })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
