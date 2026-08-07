-- Neon Barrage public leaderboard. Apply this migration in the new project.
-- The browser only receives the project's public anon key; RLS is the security boundary.

create table if not exists public.leaderboard (
  id uuid not null default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),

  constraint leaderboard_pkey primary key (id),
  constraint leaderboard_player_name_trimmed check (player_name = btrim(player_name)),
  constraint leaderboard_player_name_length check (char_length(btrim(player_name)) between 1 and 16),
  constraint leaderboard_player_name_safe_chars check (player_name ~ $$^[A-Za-z0-9]([A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$$),
  constraint leaderboard_score_range check (score between 0 and 2147483647)
);

create index if not exists leaderboard_top10_score_idx
  on public.leaderboard (score desc, created_at asc, id asc);

revoke all privileges on table public.leaderboard from public;
revoke all privileges on table public.leaderboard from anon, authenticated;
grant usage on schema public to anon;
grant select on table public.leaderboard to anon;
grant insert (player_name, score) on table public.leaderboard to anon;

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard_anon_select" on public.leaderboard;
drop policy if exists "leaderboard_anon_insert" on public.leaderboard;
create policy "leaderboard_anon_select"
  on public.leaderboard for select to anon using (true);

create policy "leaderboard_anon_insert"
  on public.leaderboard for insert to anon
  with check (
    player_name = btrim(player_name)
    and char_length(btrim(player_name)) between 1 and 16
    and player_name ~ $$^[A-Za-z0-9]([A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$$
    and score between 0 and 2147483647
  );
