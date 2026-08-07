-- Neon Barrage public leaderboard.
--
-- The table is intentionally append-only for public clients.  The browser
-- receives only the publishable/anon key; RLS and grants below are the
-- database boundary that backs that choice.

create table public.leaderboard (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),

  constraint leaderboard_name_valid check (
    name = btrim(name)
    and char_length(name) between 1 and 16
    and name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,15}$'
  ),
  constraint leaderboard_score_valid check (
    score between 0 and 100000000
  )
);

comment on table public.leaderboard is
  'Public Neon Barrage scores; clients may read and append valid rows only.';
comment on column public.leaderboard.name is
  'Trimmed ASCII display name, one to sixteen characters.';
comment on column public.leaderboard.score is
  'Non-negative plausible game score, capped at one hundred million.';

create index leaderboard_score_created_at_idx
  on public.leaderboard (score desc, created_at asc, id asc);

alter table public.leaderboard enable row level security;

-- Remove any project-level default grants before adding the narrow Data API
-- surface.  INSERT is column-scoped so public clients cannot set id or time.
revoke all on table public.leaderboard from anon, authenticated;
revoke all on sequence public.leaderboard_id_seq from anon, authenticated;

grant select on table public.leaderboard to anon, authenticated;
grant insert (name, score) on table public.leaderboard to anon, authenticated;
grant usage on sequence public.leaderboard_id_seq to anon, authenticated;

create policy "leaderboard_public_read"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

create policy "leaderboard_public_insert"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (true);
