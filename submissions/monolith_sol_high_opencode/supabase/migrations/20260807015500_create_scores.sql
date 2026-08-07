create table public.scores (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint scores_name_length check (char_length(name) between 1 and 16),
  constraint scores_name_format check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{0,15}$'),
  constraint scores_score_plausible check (score between 0 and 10000000)
);

create index scores_rank_idx on public.scores (score desc, created_at asc);

alter table public.scores enable row level security;

revoke all on table public.scores from anon, authenticated;
grant select on table public.scores to anon, authenticated;
grant insert (name, score) on table public.scores to anon, authenticated;

create policy "public leaderboard is readable"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "public may submit constrained scores"
  on public.scores for insert
  to anon, authenticated
  with check (true);
