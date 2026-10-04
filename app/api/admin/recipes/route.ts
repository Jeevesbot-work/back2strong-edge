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
  const action =
    body?.action === "approve" || body?.action === "reject" || body?.action === "approve_clean" || body?.action === "edit"
      ? body.action
      : null;
  if (!action || (action !== "approve_clean" && !id)) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  const admin = createServiceClient();
  if (action === "approve_clean") {
    const { data, error } = await admin
      .from("recipes")
      .update({ published: true, import_status: "approved" })
      .eq("published", false)
      .eq("import_status", "draft")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, published: true, count: data?.length ?? 0 });
  }

  if (action === "edit") {
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const category = typeof body?.category === "string" ? body.category : "";
    const method = Array.isArray(body?.method)
      ? body.method
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.replace(/^\d+[.)]\s+/, "").trim())
          .filter(Boolean)
      : [];
    if (!title || !["breakfast", "lunch", "dinner", "snack"].includes(category)) {
      return NextResponse.json({ error: "title and category are required" }, { status: 400 });
    }
    if (method.length < 3) {
      return NextResponse.json({ error: "Method needs at least 3 steps" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("recipes")
      .update({ title, category, method })
      .eq("id", id)
      .eq("published", false)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    return NextResponse.json({ ok: true, published: false });
  }

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
