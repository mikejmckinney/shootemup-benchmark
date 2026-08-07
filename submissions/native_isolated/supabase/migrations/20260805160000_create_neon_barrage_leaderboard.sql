-- Public read/submit access is protected by both grants and row-level security.
-- The browser roles can submit only player_name and score; the server owns id and
-- created_at defaults.

create table public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),

  constraint leaderboard_player_name_length_check
    check (char_length(btrim(player_name)) between 1 and 16),
  constraint leaderboard_player_name_control_check
    check (player_name !~ '[[:cntrl:]]'),
  constraint leaderboard_score_range_check
    check (score between 0 and 1000000000)
);

comment on table public.leaderboard is
  'Neon Barrage scores. Anonymous and authenticated clients may read and submit validated scores; rows cannot be updated or deleted through the Data API.';
comment on column public.leaderboard.id is
  'Server-generated UUID identifying the score submission.';
comment on column public.leaderboard.player_name is
  'Display name, 1 to 16 characters after trimming, with no control characters.';
comment on column public.leaderboard.score is
  'Non-negative integer score capped at 1,000,000,000.';
comment on column public.leaderboard.created_at is
  'Server timestamp assigned when the score is inserted.';

alter table public.leaderboard enable row level security;

-- Remove any project-level broad grants for the browser roles from this table.
-- PUBLIC is revoked as defense in depth; trusted server-side roles retain their
-- separately provisioned Supabase privileges.
revoke all on table public.leaderboard from public, anon, authenticated;

grant select on table public.leaderboard to anon, authenticated;
grant insert (player_name, score) on table public.leaderboard to anon, authenticated;

create policy "Leaderboard rows are publicly readable"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

create policy "Clients can submit leaderboard scores"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (true);
