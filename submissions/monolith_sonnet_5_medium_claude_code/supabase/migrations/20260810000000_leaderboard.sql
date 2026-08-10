-- Neon Barrage leaderboard schema
create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_player_name_length check (
    char_length(player_name) between 1 and 16
  ),
  constraint leaderboard_player_name_charset check (
    player_name ~ '^[A-Za-z0-9 _\-]{1,16}$'
  ),
  constraint leaderboard_score_range check (
    score >= 0 and score <= 1000000000
  )
);

create index if not exists leaderboard_score_desc_idx
  on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

-- Public can read all leaderboard rows (needed to render top scores).
create policy "leaderboard_public_select"
  on public.leaderboard
  for select
  to anon
  using (true);

-- Public can insert new scores, but only well-formed rows (checked above)
-- and only through columns exposed here (id/created_at are server-generated).
create policy "leaderboard_public_insert"
  on public.leaderboard
  for insert
  to anon
  with check (
    char_length(player_name) between 1 and 16
    and player_name ~ '^[A-Za-z0-9 _\-]{1,16}$'
    and score >= 0
    and score <= 1000000000
  );

-- No update/delete policies: leaderboard rows are append-only for anon/public.
revoke all on public.leaderboard from anon, authenticated;
grant select, insert (player_name, score) on public.leaderboard to anon;
grant select, insert (player_name, score) on public.leaderboard to authenticated;
