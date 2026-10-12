-- Voice brain-dump → to-do list.
-- A member talks through tomorrow before bed; Edge turns it into short tasks,
-- saved against the day they're for. Shown on Today as a tick-list.
create table if not exists public.day_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  for_date date not null,
  text text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists day_tasks_user_date_idx on public.day_tasks (user_id, for_date);

alter table public.day_tasks enable row level security;

create policy "day_tasks_own_select" on public.day_tasks for select using (auth.uid() = user_id);
create policy "day_tasks_own_insert" on public.day_tasks for insert with check (auth.uid() = user_id);
create policy "day_tasks_own_update" on public.day_tasks for update using (auth.uid() = user_id);
create policy "day_tasks_own_delete" on public.day_tasks for delete using (auth.uid() = user_id);
