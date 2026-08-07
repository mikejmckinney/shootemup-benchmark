create table public.leaderboard (
  id bigint generated always as identity primary key,
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint leaderboard_name_valid check (
    char_length(name) between 1 and 16
    and name = btrim(name)
    and name ~ '^[A-Za-z0-9 _-]+$'
  ),
  constraint leaderboard_score_plausible check (score between 0 and 10000000)
);

alter table public.leaderboard enable row level security;

create policy "public can read leaderboard"
on public.leaderboard for select
to anon, authenticated
using (true);

create policy "public can submit scores"
on public.leaderboard for insert
to anon, authenticated
with check (
  char_length(name) between 1 and 16
  and name = btrim(name)
  and name ~ '^[A-Za-z0-9 _-]+$'
  and score between 0 and 10000000
);

revoke all on table public.leaderboard from anon, authenticated;
grant select, insert on table public.leaderboard to anon, authenticated;
grant usage, select on sequence public.leaderboard_id_seq to anon, authenticated;
