import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

async function checkAdmin() {
  return (await isAuthorisedAdmin()) ? true : null;
}

export async function POST(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { text, priority } = await req.json();
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("admin_tasks").insert({ text, done: false, priority: priority ?? "MED", position: Date.now() }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id, done } = await req.json();
  const admin = createAdminClient();
  const { error } = await admin.from("admin_tasks").update({ done }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await checkAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await req.json();
  const admin = createAdminClient();
  const { error } = await admin.from("admin_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
