-- Neon Barrage public leaderboard.
--
-- This is the platform worker's append-only contract, integrated into the
-- coordinator-owned migration. The database checks remain authoritative even
-- if a caller skips the browser validator.
create table public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_player_name_valid check (
    player_name = btrim(player_name)
    and char_length(player_name) between 1 and 16
    and octet_length(player_name) <= 64
    and player_name !~ '[[:cntrl:]]'
  ),
  constraint leaderboard_score_valid check (score between 0 and 1000000000)
);

comment on table public.leaderboard is
  'Public Neon Barrage scores; clients may read and append valid rows only.';

create index leaderboard_score_created_at_idx
  on public.leaderboard (score desc, created_at asc, id asc);

alter table public.leaderboard enable row level security;

-- Column-scoped INSERT prevents public callers from setting server fields.
revoke all on table public.leaderboard from anon, authenticated;
revoke all on sequence public.leaderboard_id_seq from anon, authenticated;
grant select on table public.leaderboard to anon, authenticated;
grant insert (player_name, score) on table public.leaderboard to anon, authenticated;
grant usage on sequence public.leaderboard_id_seq to anon, authenticated;

create policy "leaderboard_public_read"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

create policy "leaderboard_public_insert"
  on public.leaderboard for insert
  to anon, authenticated
  with check (true);
