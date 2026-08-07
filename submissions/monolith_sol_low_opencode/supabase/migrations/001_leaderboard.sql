create table public.scores (
  id bigint generated always as identity primary key,
  player_name text not null check (char_length(player_name) between 1 and 16 and player_name ~ '^[A-Za-z0-9 _-]+$'),
  score integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;
create policy "public leaderboard read" on public.scores for select to anon using (true);
create policy "public score submission" on public.scores for insert to anon with check (true);
grant select, insert on public.scores to anon;
grant usage, select on sequence public.scores_id_seq to anon;
revoke update, delete on public.scores from anon;
create index scores_ranking_idx on public.scores (score desc, created_at asc);
