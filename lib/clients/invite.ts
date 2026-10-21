// Creating a client invite. Nick gets a link. The app does not email anyone.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedInvite =
  | { ok: true; fullName: string; email: string }
  | { ok: false; error: string };

export function parseInviteRequest(body: unknown): ParsedInvite {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Name and email are required" };
  }
  const raw = body as { full_name?: unknown; name?: unknown; email?: unknown };
  const fullName = String(raw.full_name ?? raw.name ?? "").trim().replace(/\s+/g, " ");
  const email = String(raw.email ?? "").trim().toLowerCase();
  if (!fullName || fullName.length > 80) {
    return { ok: false, error: "Enter the client's name" };
  }
  if (!email || email.length > 200 || !EMAIL.test(email)) {
    return { ok: false, error: "Enter a valid email" };
  }
  return { ok: true, fullName, email };
}

export function welcomeLink(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/welcome/${token}`;
}

export function authUserAlreadyExists(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "email_exists" || error.code === "user_already_exists") return true;
  return /already.*(registered|exists)/i.test(error.message ?? "");
}

/** Keep a name already on the profile. Never carries a programme. */
export function profileFieldsForInvite(
  existing: { full_name?: string | null } | null,
  fullName: string,
  email: string,
): { email: string; full_name: string; approved: true } {
  const kept = existing?.full_name?.trim();
  return { email, full_name: kept || fullName, approved: true };
}

/** A second invite must not rewind someone who is already on a week. */
export function programmeStateInsert(hasState: boolean): { current_day: 1; current_week: 1 } | null {
  return hasState ? null : { current_day: 1, current_week: 1 };
}

export type CreatedUser =
  | { id: string }
  | { error: { message?: string; code?: string } };

export interface InviteStore {
  createUser(email: string): Promise<CreatedUser>;
  /** Looks up an existing auth user. Must not send email. */
  findUserId(email: string): Promise<string | null>;
  readProfile(userId: string): Promise<{ full_name: string | null } | null>;
  writeProfile(userId: string, fields: { email: string; full_name: string; approved: true }): Promise<string | null>;
  hasProgrammeState(userId: string): Promise<boolean>;
  insertProgrammeState(userId: string, state: { current_day: 1; current_week: 1 }): Promise<string | null>;
  replaceInvite(email: string, token: string): Promise<string | null>;
}

export type InviteResult =
  | { ok: true; userId: string; link: string; emailed: false; fullName: string; email: string }
  | { ok: false; error: string };

export async function createClientInvite(
  store: InviteStore,
  input: { fullName: string; email: string; token: string; appUrl: string },
): Promise<InviteResult> {
  const created = await store.createUser(input.email);
  let userId: string | null = null;
  if ("id" in created) {
    userId = created.id;
  } else if (authUserAlreadyExists(created.error)) {
    userId = await store.findUserId(input.email);
  } else {
    return { ok: false, error: created.error.message || "Could not create the account" };
  }
  if (!userId) return { ok: false, error: "Could not find that account" };

  const existing = await store.readProfile(userId);
  const fields = profileFieldsForInvite(existing, input.fullName, input.email);
  const profileError = await store.writeProfile(userId, fields);
  if (profileError) return { ok: false, error: profileError };

  const state = programmeStateInsert(await store.hasProgrammeState(userId));
  if (state) {
    const stateError = await store.insertProgrammeState(userId, state);
    if (stateError) return { ok: false, error: stateError };
  }

  const inviteError = await store.replaceInvite(input.email, input.token);
  if (inviteError) return { ok: false, error: inviteError };

  return {
    ok: true,
    userId,
    email: input.email,
    fullName: fields.full_name,
    link: welcomeLink(input.appUrl, input.token),
    emailed: false,
  };
}
