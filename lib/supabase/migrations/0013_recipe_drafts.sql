-- Weekly recipe import: bookkeeping for unpublished drafts.
--
-- public.recipes already exists in Supabase. Its CREATE TABLE is not in this
-- repo. The Fuel tab (lib/recipes-live.ts) reads these columns today:
--   id, title, slug, category, description, servings, prep_time_mins,
--   cook_time_mins, calories, protein_g, carbs_g, fat_g, ingredients, method,
--   coach_note, tags, image_url, published
-- Clients only receive rows where published = true (RLS policy
-- recipes_read_all_authenticated). This migration does not widen that policy
-- and does not publish anything.
--
-- Apply it by hand in the Supabase SQL editor. Do not run it from CI and do
-- not point it at production from a script in this repo.

alter table public.recipes add column if not exists source_credit text;
alter table public.recipes add column if not exists source_url text;
alter table public.recipes add column if not exists source_platform text;
alter table public.recipes add column if not exists source_key text;
alter table public.recipes add column if not exists content_fingerprint text;
alter table public.recipes add column if not exists import_status text;
alter table public.recipes add column if not exists review_note text;
alter table public.recipes add column if not exists imported_at timestamptz;

-- draft: clean pass, waiting for review
-- flagged: inside the fat review band, still unpublished
-- rejected: Nick dismissed it; source_key stays so the same post is not imported again
-- approved: Nick published it
alter table public.recipes drop constraint if exists recipes_import_status_check;
alter table public.recipes add constraint recipes_import_status_check
  check (import_status is null or import_status in ('draft', 'flagged', 'rejected', 'approved'));

create unique index if not exists recipes_source_key_uidx
  on public.recipes (source_key)
  where source_key is not null;

create index if not exists recipes_unpublished_idx
  on public.recipes (imported_at desc)
  where published = false;
