-- Meal plans: one row per (user, week, day, slot). Backs the Fuel "Week" view.
-- Applied to Supabase 2026-09-18. day: 0 = Monday … 6 = Sunday.
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  day smallint not null check (day between 0 and 6),
  slot text not null check (slot in ('breakfast','lunch','dinner','snack')),
  recipe_id uuid references public.recipes(id) on delete set null,
  custom_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start, day, slot)
);

create index if not exists meal_plans_user_week_idx on public.meal_plans (user_id, week_start);

alter table public.meal_plans enable row level security;
create policy meal_plans_own_select on public.meal_plans for select using (auth.uid() = user_id);
create policy meal_plans_own_insert on public.meal_plans for insert with check (auth.uid() = user_id);
create policy meal_plans_own_update on public.meal_plans for update using (auth.uid() = user_id);
create policy meal_plans_own_delete on public.meal_plans for delete using (auth.uid() = user_id);
