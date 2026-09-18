import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

// Admin-only: upload a generated/sourced photo for a recipe and set its
// image_url. Used by the recipe-image batch job (and, later, by any admin UI
                                                  // for re-shooting a single recipe's photo).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "recipe-images";

export async function POST(req: NextRequest) {
if (!(await isAuthorisedAdmin())) {
return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
}

const body = await req.json().catch(() => null);
const recipeId: string | undefined = body?.recipe_id;
const imageBase64: string | undefined = body?.image_base64;
const mimeType: string = body?.mime_type || "image/jpeg";

if (!recipeId || !imageBase64) {
return NextResponse.json({ error: "recipe_id and image_base64 are required" }, { status: 400 });
}

const admin = createAdminClient();

const { data: recipe, error: recipeErr } = await admin
.from("recipes")
.select("id")
.eq("id", recipeId)
.maybeSingle();
if (recipeErr || !recipe) {
return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
}

const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
const path = `${recipeId}.${ext}`;
const bytes = Buffer.from(imageBase64, "base64");

const { error: uploadErr } = await admin.storage
.from(BUCKET)
.upload(path, bytes, { contentType: mimeType, upsert: true });
if (uploadErr) {
return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
}

const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
const url = `${pub.publicUrl}?v=${Date.now()}`;

const { error: updateErr } = await admin.from("recipes").update({ image_url: url }).eq("id", recipeId);
if (updateErr) {
return NextResponse.json({ error: `DB update failed: ${updateErr.message}` }, { status: 500 });
}

return NextResponse.json({ ok: true, url });
}
