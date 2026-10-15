import { NextRequest } from "next/server";
import { coachStore, handleCoachMessage, type CoachMessageStore } from "@/lib/coach/message";
import { createServiceClient } from "@/lib/supabase/service";
import { coachMessagePush, sendPushToUser } from "@/lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nick's bots post one approved coach message into a client's Edge chat.
// Auth is Authorization: Bearer <key>, checked as sha256 against
// COACH_MESSAGE_KEY_SHA256. This route does not read cookies.
// A new (non-duplicate) message also sends the client a phone notification.
export async function POST(req: NextRequest) {
  const base = coachStore(createServiceClient());
  const store: CoachMessageStore = {
    profileExists: base.profileExists,
    findRecentDuplicate: base.findRecentDuplicate,
    async insertMessage(userId, content) {
      const saved = await base.insertMessage(userId, content);
      try {
        await sendPushToUser(userId, coachMessagePush(content));
      } catch (err) {
        console.error("[coach/message] push failed:", err);
      }
      return saved;
    },
  };
  return handleCoachMessage(req, store);
}
