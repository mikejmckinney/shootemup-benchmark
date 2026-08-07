-- Extend the shared benchmark leaderboard to candidate 10.
-- The original eight-candidate migration remains immutable as applied history.

alter table public.leaderboard
  drop constraint if exists leaderboard_candidate_id_valid;

alter table public.leaderboard
  add constraint leaderboard_candidate_id_valid
  check (candidate_id in (
    'monolith',
    'native_dynamic',
    'native_isolated',
    'a2a',
    'monolith_warm',
    'a2a_async',
    'monolith_sol_medium',
    'monolith_opencode',
    'monolith_sol_medium_opencode'
  ));

drop policy if exists "Shared leaderboard accepts plausible scores" on public.leaderboard;

create policy "Shared leaderboard accepts plausible scores"
  on public.leaderboard
  for insert
  to anon, authenticated
  with check (
    candidate_id in (
      'monolith',
      'native_dynamic',
      'native_isolated',
      'a2a',
      'monolith_warm',
      'a2a_async',
      'monolith_sol_medium',
      'monolith_opencode',
      'monolith_sol_medium_opencode'
    )
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 16
    and player_name !~ '[[:cntrl:]]'
    and score between 0 and 2147483647
  );

comment on column public.leaderboard.candidate_id is
  'Benchmark treatment partition for the nine benchmark candidates.';
