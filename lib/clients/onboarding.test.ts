import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BARRY_PROGRAMME } from "../data/barry-programme";
import { STARTER_PROGRAMME } from "../data/starter-programme";
import { programmeAssignmentBlock, STARTER_PROGRAMME_ID } from "./assignment";
import {
  authUserAlreadyExists,
  createClientInvite,
  parseInviteRequest,
  profileFieldsForInvite,
  programmeStateInsert,
  welcomeLink,
  type InviteStore,
} from "./invite";
import { isTestProfile, loadRosterProfiles, partitionProfiles, testColumnMissing, withoutTestUsers } from "./roster";

const ADMINS = ["n.adams3@icloud.com", "nicosmada3@googlemail.com", "nick@back2strong.online"];

describe("client invite", () => {
  it("accepts a name and email and does not treat that as a send", () => {
    const parsed = parseInviteRequest({ full_name: "  Adrian   Borg ", email: " Adrian@Example.com " });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.fullName, "Adrian Borg");
    assert.equal(parsed.email, "adrian@example.com");
    assert.equal(parseInviteRequest({ full_name: "", email: "a@b.co" }).ok, false);
    assert.equal(parseInviteRequest({ full_name: "Ada", email: "not-an-email" }).ok, false);
    assert.equal(welcomeLink("https://app.back2strong.online/", "tok_1"), "https://app.back2strong.online/welcome/tok_1");
  });

  it("keeps an existing name and does not rewind programme week", () => {
    assert.deepEqual(profileFieldsForInvite({ full_name: "Ed" }, "Edward", "ed@example.com"), {
      email: "ed@example.com",
      full_name: "Ed",
      approved: true,
    });
    assert.equal(profileFieldsForInvite({ full_name: "  " }, "Adrian Borg", "a@b.co").full_name, "Adrian Borg");
    assert.equal(programmeStateInsert(true), null);
    assert.deepEqual(programmeStateInsert(false), { current_day: 1, current_week: 1 });
    assert.equal(authUserAlreadyExists({ code: "email_exists" }), true);
    assert.equal(authUserAlreadyExists({ message: "A user with this email address has already been registered" }), true);
    assert.equal(authUserAlreadyExists({ message: "database down" }), false);
  });

  it("creates a link and never asks the store to email or assign a programme", async () => {
    const calls: string[] = [];
    const store: InviteStore = {
      async createUser() {
        calls.push("createUser");
        return { error: { code: "email_exists", message: "already been registered" } };
      },
      async findUserId() {
        calls.push("findUserId");
        return "user-1";
      },
      async readProfile() {
        calls.push("readProfile");
        return { full_name: null };
      },
      async writeProfile(_id, fields) {
        calls.push(`write:${fields.full_name}`);
        assert.equal(fields.approved, true);
        return null;
      },
      async hasProgrammeState() {
        calls.push("hasState");
        return false;
      },
      async insertProgrammeState() {
        calls.push("insertState");
        return null;
      },
      async replaceInvite(_email, token) {
        calls.push(`invite:${token}`);
        return null;
      },
    };

    const result = await createClientInvite(store, {
      fullName: "Adrian Borg",
      email: "adrian@example.com",
      token: "abc",
      appUrl: "https://app.back2strong.online",
    });
    assert.deepEqual(result, {
      ok: true,
      userId: "user-1",
      email: "adrian@example.com",
      fullName: "Adrian Borg",
      link: "https://app.back2strong.online/welcome/abc",
      emailed: false,
    });
    assert.deepEqual(calls, ["createUser", "findUserId", "readProfile", "write:Adrian Borg", "hasState", "insertState", "invite:abc"]);
    assert.equal("sendEmail" in store, false);
    assert.equal("assignProgramme" in store, false);
  });

  it("does not email, and does not load a programme, in the invite route", () => {
    const src = readFileSync("app/api/admin/invite/route.ts", "utf8");
    assert.match(src, /isAuthorisedAdmin/);
    assert.match(src, /status:\s*401/);
    assert.match(src, /emailed: false/);
    assert.match(src, /insert\(\{ token, email \}\)/);
    assert.equal(src.includes("resend"), false);
    assert.equal(src.includes("inviteUserByEmail"), false);
    assert.equal(src.includes("client_programmes"), false);
    assert.equal(src.includes("STARTER"), false);
    assert.equal(src.includes("starter-foundations"), false);
    assert.equal(readFileSync("lib/clients/invite.ts", "utf8").includes("client_programmes"), false);
  });
});

describe("starter programme", () => {
  it("can be assigned to any client, and a named programme cannot", () => {
    assert.equal(STARTER_PROGRAMME.id, STARTER_PROGRAMME_ID);
    assert.equal(programmeAssignmentBlock(STARTER_PROGRAMME, "Adrian Borg"), null);
    assert.equal(programmeAssignmentBlock(STARTER_PROGRAMME, "Ed"), null);
    assert.match(programmeAssignmentBlock(BARRY_PROGRAMME, "Adrian Borg") ?? "", /written for "Barry"/);
    assert.equal(programmeAssignmentBlock(BARRY_PROGRAMME, "Barry Smith"), null);
    assert.match(programmeAssignmentBlock({ id: "other", owner: "Starter" }, "Adrian Borg") ?? "", /Starter/);
  });

  it("is only attached from the explicit assign route", () => {
    const assign = readFileSync("app/api/admin/assign-programme/route.ts", "utf8");
    assert.match(assign, /starter-foundations/);
    assert.match(assign, /programmeAssignmentBlock/);
    const invite = readFileSync("app/api/admin/invite/route.ts", "utf8");
    assert.equal(invite.includes("assign-programme"), false);
  });
});

describe("test accounts", () => {
  const rows = [
    { id: "ed", full_name: "Ed", email: "ed@example.com", approved: true, is_test: false },
    { id: "barry", full_name: "Barry", email: "barry@example.com", approved: true, is_test: false },
    { id: "nick-test", full_name: "Nick Test", email: "nicosmada3@googlemail.com", approved: true, is_test: true },
    { id: "scratch", full_name: "Scratch", email: "scratch@example.com", approved: true, is_test: true },
    { id: "pending-test", full_name: "Pending Test", email: "pending-test@example.com", approved: false, is_test: true },
    { id: "real-pending", full_name: "New Signup", email: "new@example.com", approved: false, is_test: false },
    { id: "nick-login", full_name: "Nick", email: "nick@back2strong.online", approved: true, is_test: false },
  ];

  it("hides flagged profiles from clients, pending, and rundown rows", () => {
    const split = partitionProfiles(rows, ADMINS);
    assert.deepEqual(split.clients.map((row) => row.id), ["ed", "barry"]);
    assert.deepEqual(split.pending.map((row) => row.id), ["real-pending"]);
    assert.deepEqual(split.testAccounts.map((row) => row.id), ["nick-test", "scratch", "pending-test"]);
    assert.deepEqual(split.coaches.map((row) => row.id), ["nick-login"]);
    assert.equal(isTestProfile(rows[2]), true);
    assert.equal(isTestProfile({ is_test: false }), false);

    const activity = withoutTestUsers(
      [
        { user_id: "ed", name: "Ed" },
        { user_id: "scratch", name: "Scratch" },
      ],
      new Set(["scratch", "nick-test"]),
      (row) => row.user_id,
    );
    assert.deepEqual(activity.map((row) => row.name), ["Ed"]);
  });

  it("falls back when the column is not in the database yet", async () => {
    assert.equal(testColumnMissing({ code: "PGRST204", message: "Could not find the 'is_test' column of 'profiles' in the schema cache" }), true);
    assert.equal(testColumnMissing({ code: "42703", message: "column profiles.is_test does not exist" }), true);
    assert.equal(testColumnMissing({ code: "PGRST204", message: "Could not find the table coach_reply_drafts" }), false);

    const calls: string[] = [];
    const loaded = await loadRosterProfiles(async (columns) => {
      calls.push(columns);
      if (columns.includes("is_test")) {
        return { data: null, error: { code: "PGRST204", message: "Could not find the 'is_test' column of 'profiles' in the schema cache" } };
      }
      return { data: [{ id: "ed", full_name: "Ed", email: "ed@example.com", approved: true }], error: null };
    });
    assert.equal(loaded.flagReady, false);
    assert.equal(loaded.profiles[0]?.is_test, false);
    assert.equal(calls.length, 2);
  });

  it("does not flag anyone inside the migration", () => {
    const sql = readFileSync("lib/supabase/migrations/0018_client_onboarding.sql", "utf8");
    const live = sql.split("-- Rollback")[0];
    assert.match(live, /add column if not exists is_test boolean not null default false/);
    assert.match(sql, /drop column if exists is_test/);
    assert.doesNotMatch(live, /update\s+public\.profiles/i);
    assert.equal(live.includes("nicosmada3"), false);
    assert.equal(live.includes("adrian"), false);
    assert.match(readFileSync("components/AwaitingProgramme.tsx", "utf8"), /Your programme is being built by Nick/);
  });
});
