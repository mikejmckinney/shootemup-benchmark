create table public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint leaderboard_player_name_length check (char_length(player_name) between 1 and 16),
  constraint leaderboard_player_name_trimmed check (player_name = btrim(player_name)),
  constraint leaderboard_player_name_safe check (player_name !~ E'[\\n\\r\\t]'),
  constraint leaderboard_score_plausible check (score between 0 and 2147483647)
);

create index leaderboard_score_created_at_idx
  on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

revoke all on table public.leaderboard from public;
revoke all on table public.leaderboard from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select (id, player_name, score, created_at) on table public.leaderboard to anon, authenticated;
grant insert (player_name, score) on table public.leaderboard to anon, authenticated;

create policy "Public leaderboard reads"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

create policy "Public leaderboard submissions"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    player_name = btrim(player_name)
    and char_length(player_name) between 1 and 16
    and player_name !~ E'[\\n\\r\\t]'
    and score between 0 and 2147483647
  );
