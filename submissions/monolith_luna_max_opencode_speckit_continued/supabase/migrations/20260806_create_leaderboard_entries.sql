create table if not exists public.leaderboard_entries (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_entries_name_trimmed check (name = btrim(name)),
  constraint leaderboard_entries_name_length check (char_length(name) between 1 and 16),
  constraint leaderboard_entries_name_no_controls check (name !~ '[[:cntrl:]]'),
  constraint leaderboard_entries_score_range check (score between 0 and 2147483647)
);

alter table public.leaderboard_entries enable row level security;

revoke all on table public.leaderboard_entries from anon, authenticated;
grant select (id, name, score, created_at) on table public.leaderboard_entries to anon;
grant insert (name, score) on table public.leaderboard_entries to anon;

drop policy if exists "public can read leaderboard" on public.leaderboard_entries;
create policy "public can read leaderboard"
  on public.leaderboard_entries
  for select
  to anon
  using (true);

drop policy if exists "public can submit leaderboard score" on public.leaderboard_entries;
create policy "public can submit leaderboard score"
  on public.leaderboard_entries
  for insert
  to anon
  with check (true);
