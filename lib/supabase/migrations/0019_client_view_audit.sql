-- Audit log for Command Centre "View as client".
--
-- NOT applied by this change. Do not run it against production from the app,
-- a GitHub Action, or a deploy. After review, run it by hand in the Supabase
-- SQL editor. Safe to re-run.
--
-- Numbered 0019 because 0018_client_onboarding.sql is the latest file in this
-- repo. Checked on 22 Oct 2026: no 0019_*.sql file exists on main or on the
-- other remote branches, including anything named for the weight tracker.
--
-- What it changes:
--   * Creates public.client_view_audit
--       id          uuid primary key default gen_random_uuid()
--       admin_id    uuid  (the signed-in admin, when they have a session)
--       client_id   uuid not null (the profile being viewed)
--       created_at  timestamptz not null default now()
--   * Enables row level security.
--   * Revokes the table from anon and authenticated.
--   * Grants select and insert to service_role only.
--   * Adds no policies, so a browser session cannot read or write the log.
--   * Does not change client data, messages, or auth.
--
-- Until this is applied, the app still writes the same admin id, client id,
-- and time to the server log and the view still opens.
--
-- Rollback (run only to reverse this migration):
-- drop table if exists public.client_view_audit;

create table if not exists public.client_view_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  client_id uuid not null,
  created_at timestamptz not null default now()
);

comment on table public.client_view_audit is
  'One row each time an admin opens View as client. Browser sessions cannot read or write it.';

alter table public.client_view_audit enable row level security;

revoke all on table public.client_view_audit from anon, authenticated;
grant select, insert on table public.client_view_audit to service_role;
