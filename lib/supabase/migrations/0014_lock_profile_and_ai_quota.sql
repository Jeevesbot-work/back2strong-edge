-- Lock admin-controlled profile columns, and add a service-role-only counter
-- for daily AI caps.
--
-- Apply this in the Supabase SQL editor BEFORE deploying the app change.
-- It is safe to apply while the current app is still live: client writes only
-- touch the columns granted below, and admin routes use the service role.
--
-- Rollback is in the comment at the bottom of this file. Do not run it unless
-- you are reversing the change.

-- ---------------------------------------------------------------------------
-- 1. Profiles: clients may edit their own onboarding and nutrition fields.
--    They may not change approval or any other admin-controlled column.
-- ---------------------------------------------------------------------------

-- Drop every existing UPDATE / INSERT policy. Production has used both
-- "update own profile" and "Users can update own profile".
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd in ('UPDATE', 'INSERT')
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- A client insert (onboarding, when no row exists yet) cannot arrive approved.
-- The service role bypasses RLS, so admin add-client / onboard still can.
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id and coalesce(approved, false) = false);

-- Table-level UPDATE/INSERT lets a client set every column, including ones
-- added later. Replace that with an explicit column list.
revoke insert, update on table public.profiles from public;
revoke insert, update on table public.profiles from anon;
revoke insert, update on table public.profiles from authenticated;

-- Columns the app writes from the browser today:
--   onboarding upsert: id, email, full_name, age, goal, training_state,
--     injuries, days_per_week, commitment_answer
--   profile + fuel: body_weight_kg, protein_target, calorie_target
-- id and email are included so that upsert still works. The trigger below
-- rejects an actual change to either.
grant update (
  id,
  email,
  full_name,
  age,
  goal,
  training_state,
  injuries,
  days_per_week,
  commitment_answer,
  body_weight_kg,
  protein_target,
  calorie_target
) on table public.profiles to authenticated;

grant insert (
  id,
  email,
  full_name,
  age,
  goal,
  training_state,
  injuries,
  days_per_week,
  commitment_answer,
  body_weight_kg,
  protein_target,
  calorie_target
) on table public.profiles to authenticated;

-- service_role keeps the table-level grant Supabase already gave it, so
-- approve, add-client, onboard, and the protein-nudge cron are unchanged.

create or replace function public.is_trusted_profile_writer()
returns boolean
language plpgsql
stable
as $$
declare
  jwt_role text;
begin
  begin
    jwt_role := auth.role();
  exception
    when others then
      jwt_role := null;
  end;

  if jwt_role = 'service_role' then
    return true;
  end if;

  -- SQL editor, migrations, and the auth trigger's table owner. No end-user JWT.
  if coalesce(jwt_role, '') = ''
     and current_user in ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin') then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.protect_profile_admin_columns()
returns trigger
language plpgsql
as $$
declare
  -- Keep this list in step with the GRANT above, plus updated_at (the
  -- existing trigger maintains it). Any other column — approved,
  -- last_protein_nudge_date, weights set by the coach, and columns added
  -- later — is frozen for client writes.
  allowed text[] := array[
    'full_name',
    'age',
    'goal',
    'training_state',
    'injuries',
    'days_per_week',
    'commitment_answer',
    'body_weight_kg',
    'protein_target',
    'calorie_target',
    'updated_at'
  ];
  new_json jsonb;
  old_json jsonb;
  col text;
begin
  if public.is_trusted_profile_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;
    return new;
  end if;

  new_json := to_jsonb(new);
  old_json := to_jsonb(old);

  for col in select jsonb_object_keys(new_json)
  loop
    if col = any (allowed) then
      continue;
    end if;

    -- Onboarding upsert rewrites id and email with the same values.
    if col = 'id' then
      if (new_json -> 'id') is distinct from (old_json -> 'id') then
        raise exception 'profile column id cannot be changed'
          using errcode = '42501';
      end if;
      continue;
    end if;

    if col = 'email' then
      if old_json ->> 'email' is not null
         and (new_json -> 'email') is distinct from (old_json -> 'email') then
        raise exception 'profile column email cannot be changed'
          using errcode = '42501';
      end if;
      continue;
    end if;

    if (new_json -> col) is distinct from (old_json -> col) then
      raise exception 'profile column % cannot be changed', col
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_columns on public.profiles;
create trigger profiles_protect_admin_columns
  before insert or update on public.profiles
  for each row execute procedure public.protect_profile_admin_columns();

revoke all on function public.is_trusted_profile_writer() from public, anon, authenticated;
revoke all on function public.protect_profile_admin_columns() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Daily AI counters. No client policies: only the service role, via the
--    function below. The app passes the limit, so the numbers live in
--    lib/ai/limits.ts and can change without another migration.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  kind text not null check (kind in ('coach', 'food')),
  used integer not null default 0 check (used >= 0),
  primary key (user_id, usage_date, kind)
);

alter table public.ai_daily_usage enable row level security;

revoke all on table public.ai_daily_usage from public, anon, authenticated;

create or replace function public.consume_daily_ai_use(
  p_user_id uuid,
  p_kind text,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used integer;
begin
  if p_kind not in ('coach', 'food') then
    raise exception 'invalid ai usage kind';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid ai usage limit';
  end if;
  if p_user_id is null then
    return false;
  end if;

  insert into public.ai_daily_usage (user_id, usage_date, kind, used)
  values (p_user_id, (timezone('utc', now()))::date, p_kind, 1)
  on conflict (user_id, usage_date, kind)
  do update set used = public.ai_daily_usage.used + 1
  where public.ai_daily_usage.used < p_limit
  returning used into new_used;

  return new_used is not null;
end;
$$;

revoke all on function public.consume_daily_ai_use(uuid, text, integer) from public;
revoke all on function public.consume_daily_ai_use(uuid, text, integer) from anon;
revoke all on function public.consume_daily_ai_use(uuid, text, integer) from authenticated;
grant execute on function public.consume_daily_ai_use(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Rollback (run only to reverse this migration; do not leave it uncommented)
-- ---------------------------------------------------------------------------
-- drop trigger if exists profiles_protect_admin_columns on public.profiles;
-- drop function if exists public.protect_profile_admin_columns();
-- drop function if exists public.is_trusted_profile_writer();
-- drop policy if exists "Users can update own profile" on public.profiles;
-- drop policy if exists "Users can insert own profile" on public.profiles;
-- create policy "Users can update own profile" on public.profiles
--   for update using (auth.uid() = id);
-- create policy "Users can insert own profile" on public.profiles
--   for insert with check (auth.uid() = id);
-- grant insert, update on table public.profiles to anon, authenticated;
-- drop function if exists public.consume_daily_ai_use(uuid, text, integer);
-- drop table if exists public.ai_daily_usage;
