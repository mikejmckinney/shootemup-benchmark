-- Neon Barrage public leaderboard. Apply this migration to the new project.
-- The browser only receives the project URL and anon key; no service credential is used.

create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_name_valid check (
    char_length(btrim(name)) between 1 and 16
    and name = btrim(name)
    and name ~ '^[A-Za-z0-9 _-]+$'
  ),
  constraint leaderboard_score_valid check (score between 0 and 2147483647)
);

create index if not exists leaderboard_score_order on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

drop policy if exists "public can read leaderboard" on public.leaderboard;
drop policy if exists "public can submit leaderboard scores" on public.leaderboard;

create policy "public can read leaderboard"
  on public.leaderboard for select
  to anon
  using (true);

create policy "public can submit leaderboard scores"
  on public.leaderboard for insert
  to anon
  with check (
    char_length(btrim(name)) between 1 and 16
    and name = btrim(name)
    and name ~ '^[A-Za-z0-9 _-]+$'
    and score between 0 and 2147483647
  );

revoke all on table public.leaderboard from public, authenticated;
revoke all on table public.leaderboard from anon;
grant select on table public.leaderboard to anon;
grant insert (name, score) on table public.leaderboard to anon;

-- Identity sequence access is intentionally not granted to anon; PostgreSQL's
-- identity default is evaluated by the table owner during a permitted insert.
