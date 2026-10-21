// A programme written for one person cannot be copied onto another.
// The starter is the exception, and only when Nick assigns it himself.

export const STARTER_PROGRAMME_ID = "starter-foundations";

export function programmeAssignmentBlock(
  programme: { id: string; owner?: string | null },
  clientName: string,
): string | null {
  if (programme.id === STARTER_PROGRAMME_ID) return null;
  const owner = (programme.owner ?? "").trim();
  const client = clientName.trim();
  if (!owner || !client) return null;
  const first = owner.toLowerCase().split(" ")[0];
  if (!client.toLowerCase().includes(first)) {
    return `Blocked: this programme is written for "${owner}" but the client is "${clientName}". Wrong client selected.`;
  }
  return null;
}
