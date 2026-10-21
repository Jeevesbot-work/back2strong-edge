-- Coach reply drafts.
--
-- AI replies to a client's Edge message are stored here for Nick to approve,
-- edit, or discard. They are not written to public.messages until he approves,
-- so the client cannot read them through the messages RLS policy.
--
-- This file is the change. It has NOT been applied to production.
-- Apply it by hand in the Supabase SQL editor (project xlrvcfxgvxfyrmduztza)
-- before relying on the new coach-draft flow. Safe to run before the app
-- deploy: nothing in the previous app reads this table.
--
-- What it changes:
--   * Creates public.coach_reply_drafts
--       id                 uuid primary key, default gen_random_uuid()
--       user_id            uuid not null → profiles(id) on delete cascade
--       client_message_id  uuid → messages(id) on delete set null
--                          (the client message this draft answers)
--       content            text not null (the proposed coach reply)
--       status             text not null default 'pending'
--                          check: pending | approved | discarded
--       sent_message_id    uuid → messages(id) on delete set null
--                          (the coach message created on approve)
--       created_at         timestamptz not null default now()
--       reviewed_at        timestamptz
--   * Indexes pending drafts by created_at, and drafts by user_id.
--   * Enables row level security.
--   * Revokes the table from anon and authenticated.
--   * Grants it to service_role only.
--   * Adds no policies for anon or authenticated, so the Data API cannot
--     read or write drafts with a client session.
--   * Does not alter public.messages, its policies, or any existing row.
--
-- Rollback is commented at the bottom. Do not run it unless you are
-- reversing this.

create table if not exists public.coach_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_message_id uuid references public.messages(id) on delete set null,
  content text not null,
  status text not null default 'pending',
  sent_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint coach_reply_drafts_status_check
    check (status in ('pending', 'approved', 'discarded'))
);

create index if not exists coach_reply_drafts_pending_idx
  on public.coach_reply_drafts (created_at desc)
  where status = 'pending';

create index if not exists coach_reply_drafts_user_idx
  on public.coach_reply_drafts (user_id, created_at desc);

alter table public.coach_reply_drafts enable row level security;

revoke all on table public.coach_reply_drafts from public;
revoke all on table public.coach_reply_drafts from anon;
revoke all on table public.coach_reply_drafts from authenticated;
grant all on table public.coach_reply_drafts to service_role;

-- Rollback (run only to reverse this migration):
-- drop table if exists public.coach_reply_drafts;
