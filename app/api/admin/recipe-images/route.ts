import { NextRequest, NextResponse } from "next/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { saveRecipeImage } from "@/lib/recipes/save-image";

// Admin-only: upload a generated photo for a recipe and set its image_url.
// The weekly import calls saveRecipeImage directly (it has no admin cookie).
// This route is the same write path for a manual re-shoot.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  const result = await saveRecipeImage(recipeId, imageBase64, mimeType);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, url: result.url });
}
