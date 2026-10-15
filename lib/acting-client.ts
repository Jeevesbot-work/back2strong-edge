import { cookies } from "next/headers";
import { isAdminViewer } from "@/lib/admin/auth";
import { resolvePreviewTarget } from "@/lib/preview-user";

const PREVIEW_COOKIE = "preview_user_id";

/** The signed-in user, or the client an admin is previewing. */
export async function resolveActingClient(sessionUserId: string, email?: string | null) {
  const previewId = cookies().get(PREVIEW_COOKIE)?.value;
  const admin = await isAdminViewer(email);
  const targetId = resolvePreviewTarget(sessionUserId, previewId, admin);
  return {
    targetId,
    previewing: admin && targetId !== sessionUserId,
  };
}
