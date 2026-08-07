-- Leaderboard schema with RLS and DB-side validation
create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint player_name_length check (char_length(player_name) between 1 and 16),
  constraint player_name_charset check (player_name ~ '^[A-Za-z0-9 _.-]+$'),
  constraint score_non_negative check (score >= 0),
  constraint score_plausible check (score <= 100000000)
);

create index if not exists leaderboard_score_desc_idx on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

-- Public read of leaderboard entries
drop policy if exists "Public read leaderboard" on public.leaderboard;
create policy "Public read leaderboard"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

-- Public insert with validated columns only (no update/delete)
drop policy if exists "Public insert leaderboard" on public.leaderboard;
create policy "Public insert leaderboard"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    char_length(player_name) between 1 and 16
    and player_name ~ '^[A-Za-z0-9 _.-]+$'
    and score >= 0
    and score <= 100000000
  );

grant usage on schema public to anon, authenticated;
grant select, insert on table public.leaderboard to anon, authenticated;
