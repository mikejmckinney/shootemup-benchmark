create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_name_length check (char_length(player_name) between 1 and 16),
  constraint leaderboard_name_characters check (player_name ~ '^[A-Za-z0-9 _-]+$'),
  constraint leaderboard_score_range check (score between 0 and 2147483647)
);

comment on table public.leaderboard is 'Public Neon Barrage high scores. Writes are append-only for the public client.';

create index if not exists leaderboard_score_idx on public.leaderboard (score desc, created_at asc);

alter table public.leaderboard enable row level security;

drop policy if exists "Anyone can read top scores" on public.leaderboard;
create policy "Anyone can read top scores"
  on public.leaderboard for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit a valid score" on public.leaderboard;
create policy "Anyone can submit a valid score"
  on public.leaderboard for insert
  to anon, authenticated
  with check (
    char_length(player_name) between 1 and 16
    and player_name ~ '^[A-Za-z0-9 _-]+$'
    and score between 0 and 2147483647
  );

grant usage on schema public to anon, authenticated;
grant select, insert on table public.leaderboard to anon, authenticated;
grant usage on sequence public.leaderboard_id_seq to anon, authenticated;
revoke update, delete, truncate, references, trigger on table public.leaderboard from anon, authenticated;
