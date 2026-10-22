import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectIfViewing } from "@/lib/view-as-server";

export async function POST(req: NextRequest) {
  const blocked = await rejectIfViewing();
  if (blocked) return blocked;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: { id?: unknown; done?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "Missing task" }, { status: 400 });
  }

  const { error } = await supabase.from("day_tasks").update({ done: body.done }).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't update that task." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
