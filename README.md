This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Weekly recipe import

There is no Google Drive importer in this repo. The previous path (Recipme PDF on Drive, then a manual load into Edge) happened outside the app. This replaces it.

Every Monday at 07:00 UTC a GitHub Action scrapes the creator list, keeps healthy high-protein meals, rewrites them in Edge's own words, generates an original photo, and inserts **unpublished** drafts. Clients only see `published = true`. Nick publishes a draft from **Admin → Pending recipes** (`/admin/recipes`). Rejecting a draft leaves it unpublished and stops that same post being imported again.

Nothing is published automatically. The migration is not applied by the job.

### Creators

Default list: `lib/recipe-import/creators.ts` (Instagram and YouTube handles). Override without a code change by setting `RECIPE_CREATORS_JSON` to `{"instagram":["handle"],"youtube":["@handle"]}`.

Reels that name a dish or show macros but do not write the method get a transcript from `apify/instagram-reel-scraper` (`includeTranscript`), capped at 12 a run, and that transcript is sent to Claude. Posts that point at an app, ebook, or "comment for the recipe" are skipped. The rewriter prefers simple family meals (about 10 ingredients, 30 minutes, UK names) and tags them `quick`, `batch-cook`, or `family`. Fiddly recipes lose out when the week is already full. Niche ingredients are dropped.

Each live run first adds photos to unpublished drafts that have no `image_url`. If OpenAI has no credit, that step stops and the drafts stay. When new drafts are saved, the same Resend sender used for audits emails `nick@back2strong.online` with "N new recipes ready" and a link to `/admin/recipes`. That needs `RESEND_API_KEY` on the GitHub Action. Push notifications in this app go to clients, not the admin.

### What gets kept

Per-serving rules live in `lib/recipe-import/thresholds.ts`.

| Meal | Protein | Protein share of calories | Fat passes | Fat flagged for review | Fat rejected |
| --- | --- | --- | --- | --- | --- |
| Lunch, dinner | at least 30g | at least 25% | 15g or less | over 15g up to 20g, and fat at most 30% of calories | over 20g, or in that band with fat over 30% of calories |
| Breakfast | at least 20g | at least 20% | 12g or less | over 12g up to 18g, and fat at most 30% of calories | over 18g |
| Snack | at least 15g | at least 30% | 8g or less | over 8g up to 12g, and fat at most 30% of calories | over 12g |

Breakfast is scaled down because a bowl of oats is smaller than dinner. Snacks have to be protein-dense, so 15g of protein only qualifies when the snack is about 200 kcal or less. The week aims for 10 drafts: 2 breakfast, 3 lunch, 3 dinner, 2 snack. Clean passes are chosen before fat-band flags. Promos, paywalled posts, and recipes already in the library (same post, same ingredient list, or a near-identical title) are dropped.

### Dry run

```bash
npm run recipes:dry
```

Uses `lib/recipe-import/fixture.ts` and the bundled recipe sample. It prints each extracted recipe and its filter result, and writes nothing. No API keys required.

`npm run test:recipes` checks the same fixture.

Set `RECIPE_REVIEW_PREVIEW=1` in the environment and open `/admin/recipes` to render that fixture on the review screen. Approve and reject stay disabled in preview.

### Env vars

Do not commit tokens. Add them in the GitHub repo (**Settings → Secrets and variables → Actions**) and, where noted, in the Vercel project (**Settings → Environment Variables**).

| Variable | Where | Why |
| --- | --- | --- |
| `APIFY_TOKEN` | GitHub secret. Also Vercel if you call the live cron route. | Apify actors. |
| `NEXT_PUBLIC_SUPABASE_URL` | Already on Vercel. Add the same value as a GitHub secret. | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already on Vercel. Add the same value as a GitHub secret. Never expose it to the browser. | Inserts drafts and uploads images. |
| `ANTHROPIC_API_KEY` | Already on Vercel. Add the same value as a GitHub secret. | Claude rewrites each recipe. Same key the app already uses. |
| `OPENAI_API_KEY` | GitHub secret, and Vercel if a live import is triggered there. | Original food photo (`gpt-image-1`). Not a creator's image. If it is missing, the draft is still saved and the review screen shows it without a photo. |
| `CRON_SECRET` | Vercel, already used by `/api/cron/protein-pace`. | `Authorization: Bearer` for `GET /api/cron/recipe-import`. Not used by the GitHub Action. |
| `RECIPE_CREATORS_JSON` | Optional. GitHub variable (or Vercel env). | Overrides the creator list. |
| `RECIPE_IMPORT_DRY` | Optional. Set to `1` to force a dry run. | Writes nothing. |
| `RECIPE_REVIEW_PREVIEW` | Optional, local only. Set to `1`. | Review screen shows the fixture. |

### One-time database step

Run `lib/supabase/migrations/0013_recipe_drafts.sql` in the Supabase SQL editor. It adds source credit, dedupe, and review columns to `public.recipes`. It does not publish rows and it does not change the client read policy.

### Running it

- Weekly: `.github/workflows/recipe-import.yml` (Mondays 07:00 UTC). **Run workflow** with "Dry run" ticked to rehearse.
- Local live import: `npm run recipes:import` with the env vars above in your shell. Still inserts drafts only.
- Manual HTTP trigger (same code, shorter time limit): `GET /api/cron/recipe-import` or `?dry=1`, header `Authorization: Bearer $CRON_SECRET`. The Action is the reliable weekly runner; this route is there if you want to kick a run from Vercel. It is not on the Vercel cron schedule, so it will not double-import alongside the Action.

Photos go through `saveRecipeImage` in `lib/recipes/save-image.ts`, which is also what `POST /api/admin/recipe-images` calls.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
