import { NextRequest, NextResponse } from "next/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Approve publishes one draft. Reject keeps it unpublished and retains
// source_key so next week's import does not bring the same post back.
export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action === "approve" || body?.action === "reject" ? body.action : null;
  if (!id || !action) {
    return NextResponse.json({ error: "id and action (approve or reject) are required" }, { status: 400 });
  }

  const admin = createServiceClient();
  if (action === "approve") {
    const { data, error } = await admin
      .from("recipes")
      .update({ published: true, import_status: "approved" })
      .eq("id", id)
      .eq("published", false)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    return NextResponse.json({ ok: true, published: true });
  }

  const { data, error } = await admin
    .from("recipes")
    .update({ published: false, import_status: "rejected" })
    .eq("id", id)
    .eq("published", false)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  return NextResponse.json({ ok: true, published: false });
}
