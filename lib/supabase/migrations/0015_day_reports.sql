-- "Close the day": a member talks through his day before bed (jobs, review,
-- worries). Edge turns it into a morning report, one per member per day.
create table if not exists public.day_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  for_date date not null,
  transcript text not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, for_date)
);
alter table public.day_reports enable row level security;
create policy "day_reports_own_select" on public.day_reports for select using (auth.uid() = user_id);
create policy "day_reports_own_insert" on public.day_reports for insert with check (auth.uid() = user_id);
create policy "day_reports_own_update" on public.day_reports for update using (auth.uid() = user_id);
create policy "day_reports_own_delete" on public.day_reports for delete using (auth.uid() = user_id);
