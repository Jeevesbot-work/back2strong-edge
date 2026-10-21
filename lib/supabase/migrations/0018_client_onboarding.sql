-- Hide coach test profiles without deleting them.
--
-- NOT applied by this change. Run it in the Supabase SQL editor for
-- project xlrvcfxgvxfyrmduztza after review. Safe to re-run.
--
-- Numbered 0018 because 0016 (revoke anon execute) and 0017
-- (coach_reply_drafts) are already used.
--
-- What it changes:
--   * Adds public.profiles.is_test boolean not null default false.
--   * Existing rows stay false. This file does not flag anyone.
--   * Clients cannot set the column. Migration 0014 grants authenticated
--     an explicit column list and protect_profile_admin_columns freezes
--     every other column. is_test is not on that list. The service role
--     remains a trusted writer, which is how the admin toggle updates it.
--   * Does not delete profiles, invites, or programmes.
--
-- After it is applied, mark Nick's test profiles in the admin user page.
-- Leave Ed and Barry unmarked.
--
-- How to reverse this is commented at the bottom. Do not run it unless you are
-- reversing this.

alter table public.profiles
  add column if not exists is_test boolean not null default false;

comment on column public.profiles.is_test is
  'When true, hide this profile from client lists, rundowns, and coach views. The row is kept.';

-- Rollback (run only to reverse this migration):
-- alter table public.profiles drop column if exists is_test;
