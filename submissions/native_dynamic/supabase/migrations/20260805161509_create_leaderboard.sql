-- Neon Barrage public leaderboard.
-- Public clients can submit only name/score; the UUID and timestamps are
-- database-generated and cannot be supplied or changed through the Data API.

create table public.leaderboard (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leaderboard_name_length_check
    check (char_length(name) between 1 and 16),
  constraint leaderboard_name_safe_check
    check (
      name ~ '^[A-Za-z0-9]([A-Za-z0-9 _-]{0,14}[A-Za-z0-9_-])?$'
    ),
  constraint leaderboard_score_plausible_check
    check (score between 0 and 1000000000)
);

comment on table public.leaderboard is
  'Immutable public Neon Barrage score submissions.';
comment on column public.leaderboard.name is
  'ASCII leaderboard name: 1-16 characters, letters/digits/spaces/underscore/hyphen, with no leading or trailing space.';
comment on column public.leaderboard.score is
  'Non-negative integer score capped at 1,000,000,000.';

-- Supports the public top-score query, with deterministic ordering for ties.
create index leaderboard_score_created_at_id_idx
  on public.leaderboard (score desc, created_at desc, id asc);

alter table public.leaderboard enable row level security;

-- Make the public Data API surface an explicit allowlist. The owner/service
-- roles retain administrative access; anon/authenticated get only these grants.
revoke all privileges on table public.leaderboard from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.leaderboard to anon, authenticated;
grant insert (name, score) on table public.leaderboard to anon, authenticated;

create policy "Public can read leaderboard"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

create policy "Public can submit leaderboard scores"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (true);

-- There are intentionally no UPDATE or DELETE grants or policies.
