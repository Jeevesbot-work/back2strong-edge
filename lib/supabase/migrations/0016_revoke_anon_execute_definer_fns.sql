-- 0016_revoke_anon_execute_definer_fns
-- Applied to xlrvcfxgvxfyrmduztza on 19 Oct 2026 with Nick's approval.
-- Trigger functions: triggers run them regardless of caller grants, so no client role needs EXECUTE.
-- RLS helpers ya_is_coach / ya_owns_athlete: used in RLS policies, so authenticated keeps EXECUTE.
-- service_role and postgres keep EXECUTE on all six.

revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.notify_coach()             from public, anon, authenticated;
revoke execute on function public.notify_drift_assessment()  from public, anon, authenticated;
revoke execute on function public.trg_sync_profile_weight()  from public, anon, authenticated;

revoke execute on function public.ya_is_coach()              from public, anon;
revoke execute on function public.ya_owns_athlete(uuid)      from public, anon;
grant  execute on function public.ya_is_coach()              to authenticated;
grant  execute on function public.ya_owns_athlete(uuid)      to authenticated;
