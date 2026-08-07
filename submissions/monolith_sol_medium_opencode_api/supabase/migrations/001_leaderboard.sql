create table public.leaderboard (
  id bigint generated always as identity primary key,
  name text not null constraint leaderboard_name_valid check (
    char_length(name) between 1 and 16 and name ~ '^[A-Za-z0-9 _-]+$' and name = btrim(name)
  ),
  score integer not null constraint leaderboard_score_plausible check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);

create index leaderboard_ranking on public.leaderboard (score desc, created_at asc);
alter table public.leaderboard enable row level security;

create policy "public can read scores" on public.leaderboard for select to anon using (true);
create policy "public can submit valid scores" on public.leaderboard for insert to anon with check (
  char_length(name) between 1 and 16 and name ~ '^[A-Za-z0-9 _-]+$' and name = btrim(name)
  and score between 0 and 10000000
);

revoke all on table public.leaderboard from anon, authenticated;
grant select (name, score, created_at) on table public.leaderboard to anon;
grant insert (name, score) on table public.leaderboard to anon;
grant usage on sequence public.leaderboard_id_seq to anon;
