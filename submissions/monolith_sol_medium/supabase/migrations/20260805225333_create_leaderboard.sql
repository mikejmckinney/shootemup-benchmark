create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_name_length check (char_length(player_name) between 1 and 16),
  constraint leaderboard_name_trimmed check (player_name = btrim(player_name)),
  constraint leaderboard_name_chars check (player_name ~ '^[A-Za-z0-9 _-]+$'),
  constraint leaderboard_score_plausible check (score between 0 and 10000000)
);

create index if not exists leaderboard_rank_idx on public.leaderboard (score desc, created_at asc);
alter table public.leaderboard enable row level security;

revoke all on table public.leaderboard from anon, authenticated;
revoke all on sequence public.leaderboard_id_seq from anon, authenticated;
grant select, insert on table public.leaderboard to anon, authenticated;

create policy "public leaderboard read"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

create policy "public leaderboard submit"
  on public.leaderboard for insert
  to anon, authenticated
  with check (
    char_length(player_name) between 1 and 16
    and player_name = btrim(player_name)
    and player_name ~ '^[A-Za-z0-9 _-]+$'
    and score between 0 and 10000000
  );

comment on table public.leaderboard is 'Public Neon Barrage scores; immutable to browser roles.';
