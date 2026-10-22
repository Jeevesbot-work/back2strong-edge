import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALREADY_LOGGED, recentSessions, sessionIsDuplicate } from "@/lib/logs/duplicate";
import { rejectIfViewing } from "@/lib/view-as-server";

// Finish a workout. The client used to insert straight into Supabase, so a
// second tap could write a second row before the button re-rendered.
export async function POST(req: NextRequest) {
  try {
    const blocked = await rejectIfViewing();
    if (blocked) return blocked;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const body = await req.json();
    const session_type = String(body.session_type ?? "").trim().slice(0, 80);
    const duration_minutes = Math.max(1, Math.min(600, Math.round(Number(body.duration_minutes) || 1)));
    if (!session_type) return NextResponse.json({ error: "Missing session" }, { status: 400 });

    const now = new Date();
    const recent = await recentSessions(supabase, user.id, now);
    if (sessionIsDuplicate(recent, session_type, now)) {
      return NextResponse.json({ error: ALREADY_LOGGED }, { status: 409 });
    }

    const { data: session, error } = await supabase
      .from("training_sessions")
      .insert({
        user_id: user.id,
        session_type,
        completed_at: now.toISOString(),
        duration_minutes,
      })
      .select()
      .single();

    if (error || !session) {
      console.error("[train] session insert failed:", error?.message);
      return NextResponse.json({ error: "Couldn't save that session. Try again." }, { status: 500 });
    }

    const exercises = Array.isArray(body.exercises) ? body.exercises.slice(0, 80) : [];
    const rows = exercises
      .map((row: { exercise_name?: unknown; sets_completed?: unknown; reps?: unknown; weight_kg?: unknown }) => ({
        session_id: session.id,
        user_id: user.id,
        exercise_name: String(row.exercise_name ?? "").slice(0, 120),
        sets_completed: Math.max(0, Math.round(Number(row.sets_completed) || 0)),
        reps: row.reps == null || row.reps === "" ? null : Math.round(Number(row.reps)),
        weight_kg: row.weight_kg == null || row.weight_kg === "" ? null : Number(row.weight_kg),
        struggled: false,
      }))
      .filter((row: { exercise_name: string }) => row.exercise_name);

    if (rows.length) {
      const { error: logError } = await supabase.from("exercise_logs").insert(rows);
      if (logError) console.error("[train] exercise log failed:", logError.message);
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error("[train] complete error:", err);
    return NextResponse.json({ error: "Couldn't save that session. Try again." }, { status: 500 });
  }
}
