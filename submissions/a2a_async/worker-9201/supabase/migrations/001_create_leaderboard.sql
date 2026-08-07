-- Neon Barrage public leaderboard.
-- Apply this migration to the new Supabase project before injecting its
-- project URL and publishable (anon) key into the static app.

create extension if not exists pgcrypto;

create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint leaderboard_name_valid check (
    name = btrim(name)
    and char_length(btrim(name)) between 1 and 16
    and octet_length(name) <= 64
    and name ~ '^[[:alnum:] _.''-]+$'
  ),
  constraint leaderboard_score_valid check (score between 0 and 2000000000)
);

create index if not exists leaderboard_score_rank_idx
  on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;
alter table public.leaderboard force row level security;

-- Public clients need only the ability to read scores and append a validated
-- score. They cannot update or delete historical entries.
revoke all on table public.leaderboard from anon, authenticated;
grant select on table public.leaderboard to anon, authenticated;
grant insert (name, score) on table public.leaderboard to anon, authenticated;

drop policy if exists leaderboard_public_read on public.leaderboard;
create policy leaderboard_public_read
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

drop policy if exists leaderboard_public_insert on public.leaderboard;
create policy leaderboard_public_insert
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    name = btrim(name)
    and char_length(btrim(name)) between 1 and 16
    and octet_length(name) <= 64
    and name ~ '^[[:alnum:] _.''-]+$'
    and score between 0 and 2000000000
  );
