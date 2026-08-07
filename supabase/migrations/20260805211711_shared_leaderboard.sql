-- Shared public leaderboard for all benchmark candidates.
-- Existing rows came from the monolith project and retain that partition.

alter table public.leaderboard
  add column if not exists candidate_id text;

update public.leaderboard
set candidate_id = 'monolith'
where candidate_id is null;

alter table public.leaderboard
  alter column candidate_id set not null,
  alter column candidate_id drop default;

alter table public.leaderboard
  drop constraint if exists leaderboard_candidate_id_valid;

alter table public.leaderboard
  add constraint leaderboard_candidate_id_valid
  check (candidate_id in ('monolith', 'native_dynamic', 'native_isolated', 'a2a', 'monolith_warm', 'a2a_async', 'monolith_sol_medium', 'monolith_opencode'));

create index if not exists leaderboard_candidate_score_created_idx
  on public.leaderboard (candidate_id, score desc, created_at asc, id asc);

alter table public.leaderboard enable row level security;

revoke all privileges on table public.leaderboard from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.leaderboard to anon, authenticated;
grant insert (candidate_id, player_name, score) on table public.leaderboard to anon, authenticated;

drop policy if exists "Anyone can read leaderboard" on public.leaderboard;
drop policy if exists "Anyone can submit plausible scores" on public.leaderboard;
drop policy if exists "Shared leaderboard is publicly readable" on public.leaderboard;
drop policy if exists "Shared leaderboard accepts plausible scores" on public.leaderboard;

create policy "Shared leaderboard is publicly readable"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

create policy "Shared leaderboard accepts plausible scores"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    candidate_id in ('monolith', 'native_dynamic', 'native_isolated', 'a2a', 'monolith_warm', 'a2a_async', 'monolith_sol_medium', 'monolith_opencode')
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 16
    and player_name !~ '[[:cntrl:]]'
    and score between 0 and 2147483647
  );

comment on column public.leaderboard.candidate_id is
  'Benchmark treatment partition for the eight benchmark candidates.';
