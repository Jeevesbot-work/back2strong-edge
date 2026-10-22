import { cookies } from "next/headers";
import { ADMIN_EMAILS, isAdminViewer } from "@/lib/admin/auth";
import { resolvePreviewTarget } from "@/lib/preview-user";
import { PREVIEW_COOKIE, isPreviewableClient } from "@/lib/view-as";
import { readPreviewProfile } from "@/lib/view-as-server";

export type ActingClient = {
  targetId: string;
  previewing: boolean;
  name: string | null;
};

/**
 * The signed-in user, or the client an admin is previewing.
 * The cookie is ignored unless the viewer is an admin and the id is still a
 * real, non-test client profile. Reads that follow must use the service role
 * only when previewing is true, and only for targetId.
 */
export async function resolveActingClient(sessionUserId: string, email?: string | null): Promise<ActingClient> {
  const previewId = cookies().get(PREVIEW_COOKIE)?.value;
  const admin = await isAdminViewer(email);
  const candidate = resolvePreviewTarget(sessionUserId, previewId, admin);
  if (!admin || candidate === sessionUserId) {
    return { targetId: sessionUserId, previewing: false, name: null };
  }

  const profile = await readPreviewProfile(candidate);
  if (!isPreviewableClient(profile, ADMIN_EMAILS)) {
    return { targetId: sessionUserId, previewing: false, name: null };
  }

  return {
    targetId: candidate,
    previewing: true,
    name: profile?.full_name?.trim() || "Client",
  };
}
