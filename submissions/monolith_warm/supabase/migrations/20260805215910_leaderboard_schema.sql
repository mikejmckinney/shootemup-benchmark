create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_player_name_format check (
    player_name = btrim(player_name)
    and char_length(player_name) between 1 and 16
    and player_name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{0,15}$'
  ),
  constraint leaderboard_score_plausible check (score between 0 and 999999999)
);

alter table public.leaderboard enable row level security;

revoke all on public.leaderboard from anon, authenticated;
grant select (id, player_name, score, created_at), insert (player_name, score)
  on public.leaderboard to anon, authenticated;

drop policy if exists "Leaderboard is publicly readable" on public.leaderboard;
create policy "Leaderboard is publicly readable"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit a valid score" on public.leaderboard;
create policy "Anyone can submit a valid score"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    player_name = btrim(player_name)
    and char_length(player_name) between 1 and 16
    and player_name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{0,15}$'
    and score between 0 and 999999999
  );
