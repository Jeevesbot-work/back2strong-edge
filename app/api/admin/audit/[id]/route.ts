import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const ADMINS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("coach_notes").select("id, title, body, tag").eq("id", params.id).single();
  if (error || !data) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(data.body ?? "{}"); } catch { parsed = {}; }
  return NextResponse.json({
    id: data.id,
    full_name: data.title,
    email: (parsed.email as string) ?? null,
    status: data.tag,
    data: parsed,
  });
}
