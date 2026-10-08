const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whose data a page may load. The preview cookie is honoured only for an
 * admin, and only when it is a UUID. Everyone else stays on their own id.
 */
export function resolvePreviewTarget(
  sessionUserId: string,
  previewId: string | undefined,
  isAdmin: boolean,
): string {
  if (isAdmin && previewId && UUID.test(previewId)) return previewId;
  return sessionUserId;
}
