-- Coach Fuel Reports: Nick reviews a client's logged day and sends back a
-- macro breakdown + note, shown as a card on the client's Fuel > Today tab.
create table if not exists public.fuel_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  totals jsonb not null,   -- { calories, protein_g, carbs_g, fat_g }
  targets jsonb not null,  -- { calories, protein_g, carbs_g, fat_g }
  items jsonb not null default '[]'::jsonb, -- [{ meal_name, calories, protein_g, carbs_g, fat_g, duplicate }]
  note text,
  created_at timestamptz not null default now()
);
create index if not exists fuel_reports_user_date_idx on public.fuel_reports (user_id, created_at desc);
alter table public.fuel_reports enable row level security;

-- Clients can read their own reports. Writes only via service role (admin routes).
drop policy if exists "fuel_reports_select_own" on public.fuel_reports;
create policy "fuel_reports_select_own" on public.fuel_reports
  for select using (auth.uid() = user_id);
