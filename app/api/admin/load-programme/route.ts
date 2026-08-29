import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  // Auth guard — admin only
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmails = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const { userId, programme, sessions } = body;

  if (!userId || !programme || !sessions) {
    return NextResponse.json({ error: "userId, programme, and sessions are required" }, { status: 400 });
  }

  // Service role for write access (client_programmes has no INSERT policy for regular users)
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error } = await admin
    .from("client_programmes")
    .upsert({ user_id: userId, programme, sessions }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
