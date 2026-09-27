-- Reusable sign-in invites Nick sends by WhatsApp. Valid 7 days, so a client can
-- sign in from WhatsApp, then Safari, then the home-screen app with one link.
create table if not exists public.login_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  uses int not null default 0,
  last_used_at timestamptz,
  revoked boolean not null default false
);
create index if not exists login_invites_email_idx on public.login_invites (email);
alter table public.login_invites enable row level security;
-- No policies: only the service role (server routes) can read or write.
