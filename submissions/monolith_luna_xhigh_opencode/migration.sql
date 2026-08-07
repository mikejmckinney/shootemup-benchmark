-- Neon Barrage leaderboard schema. Apply with the Supabase SQL editor or management API.
create extension if not exists pgcrypto;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint scores_name_length check (char_length(name) between 1 and 16),
  constraint scores_name_chars check (name ~ '^[A-Za-z0-9 _-]{1,16}$'),
  constraint scores_non_negative check (score between 0 and 2147483647)
);

create index if not exists scores_score_created_idx on public.scores (score desc, created_at asc);

alter table public.scores enable row level security;

drop policy if exists "Public can read leaderboard" on public.scores;
create policy "Public can read leaderboard" on public.scores
  for select to anon, authenticated using (true);

drop policy if exists "Public can submit plausible scores" on public.scores;
create policy "Public can submit plausible scores" on public.scores
  for insert to anon, authenticated
  with check (
    char_length(name) between 1 and 16
    and name ~ '^[A-Za-z0-9 _-]{1,16}$'
    and score between 0 and 2147483647
  );

revoke all on table public.scores from public;
grant select, insert on table public.scores to anon, authenticated;
