-- Neon Barrage leaderboard schema.
-- Public (anon) clients may read the leaderboard and insert their own score.
-- No update/delete is granted to anon; validation lives in the database.

create table if not exists public.leaderboard (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  score       integer not null,
  created_at  timestamptz not null default now(),
  constraint leaderboard_name_valid
    check (name = btrim(name) and name ~ '^[A-Za-z0-9 ._-]{1,16}$'),
  constraint leaderboard_score_valid
    check (score >= 0 and score <= 10000000)
);

create index if not exists leaderboard_score_desc_idx
  on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;
alter table public.leaderboard force row level security;

-- Minimum public surface: read the board, append a score.
revoke all on public.leaderboard from anon, authenticated;
grant select, insert on public.leaderboard to anon, authenticated;

drop policy if exists "leaderboard_public_read" on public.leaderboard;
create policy "leaderboard_public_read"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

drop policy if exists "leaderboard_public_insert" on public.leaderboard;
create policy "leaderboard_public_insert"
  on public.leaderboard for insert
  to anon, authenticated
  with check (
    name = btrim(name)
    and name ~ '^[A-Za-z0-9 ._-]{1,16}$'
    and score >= 0
    and score <= 10000000
  );
