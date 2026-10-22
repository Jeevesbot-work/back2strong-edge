import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminViewer } from "@/lib/admin/auth";
import { testColumnMissing } from "@/lib/clients/roster";
import { resolvePreviewTarget } from "@/lib/preview-user";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  PREVIEW_COOKIE,
  VIEW_READONLY_ERROR,
  VIEW_READONLY_STATUS,
  clientWriteDecision,
  type PreviewProfile,
} from "@/lib/view-as";

type ProfileQuery = {
  data: PreviewProfile | null;
  error: { code?: string; message?: string } | null;
};

/**
 * Load the profile the preview cookie names. Service role, server only.
 * A missing is_test column (migration 0018 not applied yet) is treated as
 * "not a test account", matching the roster. Any other error fails closed.
 */
export async function readPreviewProfile(clientId: string): Promise<PreviewProfile | null> {
  const db = createAdminClient();
  const withFlag = await db
    .from("profiles")
    .select("id, email, full_name, is_test, approved")
    .eq("id", clientId)
    .maybeSingle() as unknown as ProfileQuery;

  if (!withFlag.error) return withFlag.data;
  if (!testColumnMissing(withFlag.error)) {
    console.error("[view-as] profile read failed");
    return null;
  }

  const plain = await db
    .from("profiles")
    .select("id, email, full_name, approved")
    .eq("id", clientId)
    .maybeSingle() as unknown as ProfileQuery;
  if (plain.error || !plain.data) return null;
  return { ...plain.data, is_test: false };
}

/**
 * One row per time an admin opens a client's app. The insert uses the service
 * role. If migration 0019 is not applied yet, the same fields are written to
 * the server log and the view still opens. This does not run the migration.
 */
export async function recordClientView(adminId: string | null, clientId: string): Promise<void> {
  const row = {
    admin_id: adminId,
    client_id: clientId,
    created_at: new Date().toISOString(),
  };
  try {
    const db = createAdminClient();
    const { error } = await db.from("client_view_audit").insert(row);
    if (error) console.info("[client-view]", JSON.stringify({ ...row, stored: false }));
  } catch {
    console.info("[client-view]", JSON.stringify({ ...row, stored: false }));
  }
}

/**
 * Reject a client-app write before any insert, model call, or notification.
 * An admin holding a preview cookie is blocked even if the profile read fails,
 * so a lookup error cannot open a write. A non-admin's cookie is ignored.
 */
export async function rejectIfViewing(): Promise<NextResponse | null> {
  const decision = clientWriteDecision(await isViewingClient());
  if (decision.ok) return null;
  return NextResponse.json({ error: decision.error, readOnly: true }, { status: decision.status });
}

export async function isViewingClient(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const admin = await isAdminViewer(user.email);
    const previewId = cookies().get(PREVIEW_COOKIE)?.value;
    const candidate = resolvePreviewTarget(user.id, previewId, admin);
    return admin && candidate !== user.id;
  } catch {
    const previewId = cookies().get(PREVIEW_COOKIE)?.value;
    if (previewId && /^[0-9a-f-]{36}$/i.test(previewId)) {
      console.error("[view-as] could not confirm the viewer; blocking the write");
      return true;
    }
    return false;
  }
}

export function readOnlyResponse(): NextResponse {
  return NextResponse.json({ error: VIEW_READONLY_ERROR, readOnly: true }, { status: VIEW_READONLY_STATUS });
}
