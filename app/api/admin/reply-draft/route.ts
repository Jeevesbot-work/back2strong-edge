import { NextRequest, NextResponse } from "next/server";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { reviewDraft, reviewStoreFromSupabase } from "@/lib/coach/replies";
import { coachMessagePush, sendPushToUser } from "@/lib/push-server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nick approves, edits, or discards one AI reply draft.
// Approve writes a normal coach message (same shape as /api/admin/message-client)
// and pings the client's phone. The draft text never goes out on its own.
export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const input = body && typeof body === "object" ? (body as { id?: unknown; action?: unknown; content?: unknown }) : {};

  try {
    const result = await reviewDraft(reviewStoreFromSupabase(createServiceClient() as never), input);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.http });

    if (result.status === "approved") {
      try {
        await sendPushToUser(result.userId, coachMessagePush(result.content));
      } catch (err) {
        console.error("[reply-draft] push failed:", err);
      }
      return NextResponse.json({ ok: true, status: "approved", id: result.messageId });
    }

    return NextResponse.json({ ok: true, status: "discarded" });
  } catch (err) {
    console.error("[reply-draft] review failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't update that draft" }, { status: 500 });
  }
}
