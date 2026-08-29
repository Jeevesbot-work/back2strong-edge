import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ADMIN_EMAILS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const [{ data: cp }, { data: profile }] = await Promise.all([
    admin.from("client_programmes").select("programme, sessions, updated_at").eq("user_id", userId).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", userId).single(),
  ]);

  return NextResponse.json({
    hasProgramme: !!cp,
    name: profile?.full_name ?? null,
    current: cp ? { programme: cp.programme, sessions: cp.sessions } : null,
    updatedAt: cp?.updated_at ?? null,
  });
}
