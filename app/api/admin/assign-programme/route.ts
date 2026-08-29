import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Programme } from "@/types";
import { BARRY_PROGRAMME } from "@/lib/data/barry-programme";
import { BARRY_PROGRAMME_BLOCK2, BARRY_BLOCK2_SESSIONS } from "@/lib/data/barry-programme-block2";
import { ALEX_GALE_PROGRAMME } from "@/lib/data/alex-gale-programme";
import { isAuthorisedAdmin } from "@/lib/admin/auth";

const PROGRAMMES: Record<string, { programme: Programme; sessions?: unknown }> = {
  "barry-strong90-block1": { programme: BARRY_PROGRAMME, sessions: {} },
  "barry-strong90-block2": { programme: BARRY_PROGRAMME_BLOCK2, sessions: BARRY_BLOCK2_SESSIONS },
  "alex-gale-strong90-block1": { programme: ALEX_GALE_PROGRAMME, sessions: {} },
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { userId, programmeId } = await req.json();
  if (!userId || !programmeId) {
    return NextResponse.json({ error: "Missing userId or programmeId" }, { status: 400 });
  }

  const entry = PROGRAMMES[programmeId];
  if (!entry) {
    return NextResponse.json({ error: "Unknown programme" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Cross-contamination guard: a programme written for one client can never be
  // assigned to a different client. Owner must match the client's first name,
  // unless explicitly confirmed via force=true.
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();

  const owner = entry.programme.owner?.toLowerCase() ?? "";
  const clientName = (targetProfile?.full_name ?? "").toLowerCase();
  if (owner && clientName && !clientName.includes(owner.split(" ")[0])) {
    return NextResponse.json(
      { error: `Blocked: this programme is written for "${entry.programme.owner}" but the client is "${targetProfile?.full_name}". Wrong client selected.` },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("client_programmes")
    .upsert({ user_id: userId, programme: entry.programme, sessions: entry.sessions ?? {} }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("programme_state")
    .upsert({ user_id: userId, current_week: 1, current_day: 1 }, { onConflict: "user_id" });

  return NextResponse.json({ ok: true });
}
