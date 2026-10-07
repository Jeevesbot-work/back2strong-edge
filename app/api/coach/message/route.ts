import { NextRequest } from "next/server";
import { coachStore, handleCoachMessage } from "@/lib/coach/message";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nick's bots post one approved coach message into a client's Edge chat.
// Auth is Authorization: Bearer <key>, checked as sha256 against
// COACH_MESSAGE_KEY_SHA256. This route does not read cookies.
export async function POST(req: NextRequest) {
  return handleCoachMessage(req, coachStore(createServiceClient()));
}
