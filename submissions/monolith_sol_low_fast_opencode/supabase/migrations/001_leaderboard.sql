create table public.scores (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint scores_name_valid check (player_name = btrim(player_name) and char_length(player_name) between 1 and 16 and player_name ~ '^[A-Za-z0-9 _-]+$'),
  constraint scores_score_valid check (score between 0 and 10000000)
);

create index scores_rank_idx on public.scores (score desc, created_at asc);
alter table public.scores enable row level security;

create policy "public can view scores" on public.scores for select to anon using (true);
create policy "public can submit scores" on public.scores for insert to anon with check (
  player_name = btrim(player_name)
  and char_length(player_name) between 1 and 16
  and player_name ~ '^[A-Za-z0-9 _-]+$'
  and score between 0 and 10000000
);

grant select, insert on public.scores to anon;
grant usage, select on sequence public.scores_id_seq to anon;
revoke update, delete on public.scores from anon;
