import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAuthorisedAdmin } from "@/lib/admin/auth";
import { testColumnMissing } from "@/lib/clients/roster";

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marks a profile as a test account, or clears the flag. Does not delete the row.
export async function POST(req: NextRequest) {
  if (!(await isAuthorisedAdmin())) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!USER_ID.test(userId) || typeof body?.is_test !== "boolean") {
    return NextResponse.json({ error: "userId and is_test are required" }, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("profiles")
    .update({ is_test: body.is_test })
    .eq("id", userId)
    .select("id, is_test")
    .maybeSingle();

  if (error && testColumnMissing(error)) {
    return NextResponse.json(
      { error: "Apply migration 0018_client_onboarding.sql in the Supabase SQL editor before marking test accounts." },
      { status: 409 },
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ ok: true, is_test: data.is_test === true });
}
