-- Performance Blueprint scoreboard (the Home ring + Your Numbers screen).
-- Rows can be created before the client has an account (client_email set,
-- user_id null); /api/admin/onboard links them by email when the account is made.
create table if not exists public.blueprint_scoreboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_email text,
  metric_key text not null,
  label text not null,
  unit text,
  baseline numeric,
  target numeric,
  current_value numeric,
  direction text not null default 'down' check (direction in ('down','up')),
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists blueprint_scoreboard_user_idx on public.blueprint_scoreboard(user_id);
alter table public.blueprint_scoreboard enable row level security;
drop policy if exists "own scoreboard read" on public.blueprint_scoreboard;
create policy "own scoreboard read" on public.blueprint_scoreboard for select using (auth.uid() = user_id);
alter table public.blood_panels add column if not exists client_email text;
alter table public.doctor_reports add column if not exists client_email text;
alter table public.doctor_reports add column if not exists client_notes jsonb; -- client-facing, plain-English debrief points
