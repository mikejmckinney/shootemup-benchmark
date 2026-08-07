-- Neon Barrage leaderboard schema
-- Public anon clients may INSERT validated scores and SELECT top entries.
-- No UPDATE/DELETE for anon. Service role is never exposed to the browser.

create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint player_name_length check (
    char_length(player_name) >= 1 and char_length(player_name) <= 16
  ),
  constraint player_name_charset check (
    player_name ~ '^[A-Za-z0-9 _.-]+$'
  ),
  constraint score_non_negative check (score >= 0),
  constraint score_plausible check (score <= 10000000)
);

create index if not exists leaderboard_score_desc_idx
  on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

-- Allow anyone to read leaderboard entries (needed for top-10 display)
create policy "Public read leaderboard"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

-- Allow anyone to insert a validated score row (constraints enforce validation)
create policy "Public insert leaderboard"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    char_length(player_name) >= 1
    and char_length(player_name) <= 16
    and player_name ~ '^[A-Za-z0-9 _.-]+$'
    and score >= 0
    and score <= 10000000
  );

-- Explicitly no update/delete policies for anon/authenticated.
revoke update, delete on public.leaderboard from anon, authenticated;
grant select, insert on public.leaderboard to anon, authenticated;
grant usage, select on sequence leaderboard_id_seq to anon, authenticated;
