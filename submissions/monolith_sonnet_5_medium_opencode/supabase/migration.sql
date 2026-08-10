-- Neon Barrage leaderboard schema
-- Run against a fresh Supabase project (public schema).

create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint player_name_length check (char_length(player_name) between 1 and 16),
  constraint player_name_charset check (player_name ~ '^[A-Za-z0-9 _.\-]{1,16}$'),
  constraint score_range check (score >= 0 and score <= 100000000)
);

-- Enable RLS
alter table public.leaderboard enable row level security;

-- Public can read all rows (leaderboard is public data)
drop policy if exists "leaderboard_select_public" on public.leaderboard;
create policy "leaderboard_select_public"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

-- Public can insert a new score, but only with valid shape
-- (column-level checks are enforced by table CHECK constraints above)
drop policy if exists "leaderboard_insert_public" on public.leaderboard;
create policy "leaderboard_insert_public"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    char_length(player_name) between 1 and 16
    and player_name ~ '^[A-Za-z0-9 _.\-]{1,16}$'
    and score >= 0
    and score <= 100000000
  );

-- No update or delete policies are defined, so those operations are
-- denied by default under RLS for anon/authenticated roles.

-- Helpful index for top-10 queries
create index if not exists leaderboard_score_desc_idx
  on public.leaderboard (score desc, created_at asc);

-- Revoke broad privileges; rely on RLS + explicit grants
revoke all on public.leaderboard from anon, authenticated;
grant select, insert on public.leaderboard to anon, authenticated;
grant usage, select on sequence public.leaderboard_id_seq to anon, authenticated;
