-- Neon Barrage public leaderboard. Apply with the Supabase SQL editor or CLI.
create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_name_valid check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,15}$'),
  constraint leaderboard_score_valid check (score >= 0 and score <= 2147483647)
);

alter table public.leaderboard enable row level security;

drop policy if exists "Anyone can read the top pilots" on public.leaderboard;
create policy "Anyone can read the top pilots"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit a plausible score" on public.leaderboard;
create policy "Anyone can submit a plausible score"
  on public.leaderboard for insert
  to anon, authenticated
  with check (
    name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,15}$'
    and score >= 0
    and score <= 2147483647
  );

revoke update, delete, truncate on public.leaderboard from anon, authenticated;
grant select, insert on public.leaderboard to anon, authenticated;
