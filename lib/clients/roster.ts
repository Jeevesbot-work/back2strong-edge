// Which profiles belong on Nick's client lists. Test accounts stay in the
// database and drop out of lists, rundowns, and coach views.

export interface RosterProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  approved?: boolean | null;
  is_test?: boolean | null;
}

export function isTestProfile(profile: { is_test?: boolean | null } | null | undefined): boolean {
  return profile?.is_test === true;
}

export function testColumnMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  if (!/is_test/i.test(message)) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column|schema cache|does not exist/i.test(message);
}

export function partitionProfiles<T extends RosterProfile>(rows: readonly T[], adminEmails: readonly string[]) {
  const admins = new Set(adminEmails.map((email) => email.toLowerCase()));
  const clients: T[] = [];
  const pending: T[] = [];
  const testAccounts: T[] = [];
  const coaches: T[] = [];
  for (const row of rows) {
    if (isTestProfile(row)) {
      testAccounts.push(row);
      continue;
    }
    const email = String(row.email ?? "").toLowerCase();
    if (admins.has(email)) {
      coaches.push(row);
      continue;
    }
    if (row.approved) clients.push(row);
    else pending.push(row);
  }
  return { clients, pending, testAccounts, coaches };
}

export function withoutTestUsers<T>(
  rows: readonly T[] | null | undefined,
  testIds: ReadonlySet<string>,
  userId: (row: T) => string | null | undefined,
): T[] {
  return (rows ?? []).filter((row) => {
    const id = userId(row);
    return !id || !testIds.has(id);
  });
}

const ROSTER_COLUMNS = "id, full_name, email, approved, created_at";

type QueryError = { code?: string; message?: string } | null;
type QueryResult = { data: unknown; error: QueryError };

function asProfiles(data: unknown): RosterProfile[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const profile = row as RosterProfile;
    if (typeof profile.id !== "string") return [];
    return [profile];
  });
}

export async function loadRosterProfiles(
  query: (columns: string) => PromiseLike<QueryResult>,
): Promise<{ profiles: Array<RosterProfile & { is_test: boolean }>; flagReady: boolean }> {
  const withFlag = await query(`${ROSTER_COLUMNS}, is_test`);
  if (!withFlag.error) {
    return {
      profiles: asProfiles(withFlag.data).map((row) => ({ ...row, is_test: row.is_test === true })),
      flagReady: true,
    };
  }
  if (!testColumnMissing(withFlag.error)) {
    return { profiles: [], flagReady: true };
  }
  const plain = await query(ROSTER_COLUMNS);
  return {
    profiles: asProfiles(plain.data).map((row) => ({ ...row, is_test: false })),
    flagReady: false,
  };
}
