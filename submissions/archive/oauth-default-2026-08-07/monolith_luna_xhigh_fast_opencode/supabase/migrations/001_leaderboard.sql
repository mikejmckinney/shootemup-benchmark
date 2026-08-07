-- Neon Barrage public leaderboard. Apply with the Supabase SQL editor or CLI.
create table if not exists public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_name_length check (char_length(btrim(player_name)) between 1 and 16),
  constraint leaderboard_name_chars check (player_name ~ '^[A-Za-z0-9 _-]+$'),
  constraint leaderboard_score_range check (score between 0 and 2147483647)
);

create index if not exists leaderboard_score_idx on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

drop policy if exists "Public can read leaderboard" on public.leaderboard;
create policy "Public can read leaderboard"
  on public.leaderboard for select to anon, authenticated using (true);

drop policy if exists "Public can submit valid scores" on public.leaderboard;
create policy "Public can submit valid scores"
  on public.leaderboard for insert to anon, authenticated
  with check (
    char_length(btrim(player_name)) between 1 and 16
    and player_name ~ '^[A-Za-z0-9 _-]+$'
    and score between 0 and 2147483647
  );

revoke all on table public.leaderboard from anon, authenticated;
grant select, insert on table public.leaderboard to anon, authenticated;
