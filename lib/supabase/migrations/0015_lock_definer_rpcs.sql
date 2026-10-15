-- Tighten SECURITY DEFINER functions that PostgREST exposes to anon.
-- Confirmed against the 2026-10-08 schema snapshot. Not applied here.
--
-- Safe to run before or after the app deploy. Nothing in this repo calls
-- these functions. The daily job sync-programme-state-daily is pg_cron
-- (`select public.sync_programme_state()` at 00:05 UTC) and keeps running:
-- it executes as the database role that scheduled it (postgres / supabase_admin),
-- not as anon.
--
-- Rollback is commented at the bottom. Do not run it unless you are reversing this.

-- ---------------------------------------------------------------------------
-- sync_programme_state: rewrites every active programme_state row, bypassing
-- RLS. Anon could call it and undo a manual week change. The cron is the
-- only legitimate caller. search_path is already pinned.
-- ---------------------------------------------------------------------------
revoke all on function public.sync_programme_state() from public;
revoke all on function public.sync_programme_state() from anon;
revoke all on function public.sync_programme_state() from authenticated;
grant execute on function public.sync_programme_state() to postgres;
grant execute on function public.sync_programme_state() to service_role;
grant execute on function public.sync_programme_state() to supabase_admin;

-- ---------------------------------------------------------------------------
-- ya_owns_athlete: a missing JWT email was compared with a missing
-- family_email (both become ''), so anon "owned" every athlete who had no
-- family email. Policies on the youth-athlete tables use this function, so
-- anon could read and write those rows. A real email match still counts.
-- Execute stays granted: row-level policies call this function.
-- ---------------------------------------------------------------------------
create or replace function public.ya_owns_athlete(a_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ya_athletes a
    where a.id = a_id
      and (
        (auth.uid() is not null and a.family_user_id = auth.uid())
        or (
          coalesce(auth.jwt() ->> 'email', '') <> ''
          and lower(a.family_email) = lower(auth.jwt() ->> 'email')
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- ya_is_coach: users.role is writable by the signed-in user (the users
-- update policy does not pin columns), so anyone could set role = 'admin'
-- and pass this check. Trust the JWT email instead: the coach_email setting,
-- or the known coach addresses. Execute stays granted for the policies.
-- ---------------------------------------------------------------------------
create or replace function public.ya_is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_settings s
    where s.key = 'coach_email'
      and coalesce(s.value, '') <> ''
      and lower(s.value) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'nick@back2strong.online',
    'n.adams3@icloud.com',
    'nicosmada3@googlemail.com'
  );
$$;

-- ---------------------------------------------------------------------------
-- ya_claim_athlete: anon is rejected inside, but was still exposed. A
-- signed-in caller was also handed the name of any athlete id, including
-- ones they do not own. Claiming an athlete that has no family user and no
-- family email still works for a signed-in user, and still returns that row.
-- ---------------------------------------------------------------------------
create or replace function public.ya_claim_athlete(a_id uuid)
returns table(id uuid, name text, claimed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  update public.ya_athletes a
     set family_user_id = v_uid,
         family_email = coalesce(a.family_email, v_email)
   where a.id = a_id
     and a.family_user_id is null
     and a.family_email is null;

  return query
    select a.id, a.name, true
      from public.ya_athletes a
     where a.id = a_id
       and (
         a.family_user_id = v_uid
         or (
           coalesce(v_email, '') <> ''
           and lower(a.family_email) = lower(v_email)
         )
       );
end;
$$;

revoke all on function public.ya_claim_athlete(uuid) from public;
revoke all on function public.ya_claim_athlete(uuid) from anon;
grant execute on function public.ya_claim_athlete(uuid) to authenticated;
grant execute on function public.ya_claim_athlete(uuid) to service_role;

-- ya_save_test_battery already refuses non-coaches. Anon does not need it.
revoke all on function public.ya_save_test_battery(uuid, integer, jsonb) from public;
revoke all on function public.ya_save_test_battery(uuid, integer, jsonb) from anon;
grant execute on function public.ya_save_test_battery(uuid, integer, jsonb) to authenticated;
grant execute on function public.ya_save_test_battery(uuid, integer, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Rollback (run only to reverse this migration)
-- ---------------------------------------------------------------------------
-- grant execute on function public.sync_programme_state() to public, anon, authenticated;
--
-- create or replace function public.ya_owns_athlete(a_id uuid)
-- returns boolean language sql stable security definer set search_path = public
-- as $fn$
--   select exists (
--     select 1 from public.ya_athletes a
--     where a.id = a_id
--       and (
--         a.family_user_id = auth.uid()
--         or lower(coalesce(a.family_email,'')) = lower(coalesce(auth.jwt() ->> 'email',''))
--       )
--   );
-- $fn$;
--
-- create or replace function public.ya_is_coach()
-- returns boolean language sql stable security definer set search_path = public
-- as $fn$
--   select exists (
--     select 1 from public.app_settings s
--     where s.key = 'coach_email'
--       and lower(s.value) = lower(coalesce(auth.jwt() ->> 'email', '~none~'))
--   )
--   or exists (
--     select 1 from public.users u
--     where u.id = auth.uid() and u.role = 'admin'
--   );
-- $fn$;
--
-- create or replace function public.ya_claim_athlete(a_id uuid)
-- returns table(id uuid, name text, claimed boolean)
-- language plpgsql security definer set search_path = public
-- as $fn$
-- declare
--   v_email text := auth.jwt() ->> 'email';
--   v_uid uuid := auth.uid();
-- begin
--   if v_uid is null then
--     raise exception 'not signed in';
--   end if;
--   update public.ya_athletes a
--      set family_user_id = v_uid,
--          family_email = coalesce(a.family_email, v_email)
--    where a.id = a_id
--      and a.family_user_id is null
--      and a.family_email is null;
--   return query
--     select a.id, a.name,
--            (a.family_user_id = v_uid
--             or lower(coalesce(a.family_email,'')) = lower(coalesce(v_email,'')))
--       from public.ya_athletes a
--      where a.id = a_id;
-- end;
-- $fn$;
--
-- grant execute on function public.ya_claim_athlete(uuid) to public, anon, authenticated, service_role;
-- grant execute on function public.ya_save_test_battery(uuid, integer, jsonb) to public, anon, authenticated, service_role;
