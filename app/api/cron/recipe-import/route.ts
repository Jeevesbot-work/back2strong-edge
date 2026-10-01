import { NextRequest, NextResponse } from "next/server";
import { runRecipeImport } from "@/lib/recipe-import/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Manual trigger. The weekly run lives in GitHub Actions
// (.github/workflows/recipe-import.yml) because Apify plus image generation
// usually outlasts a serverless limit. This route is the same pipeline:
//   GET /api/cron/recipe-import?dry=1     fixture, writes nothing
//   GET /api/cron/recipe-import           live import, unpublished drafts only
// Authorization: Bearer CRON_SECRET, same as the protein-pace cron.

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  try {
    const report = await runRecipeImport({ dry });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
