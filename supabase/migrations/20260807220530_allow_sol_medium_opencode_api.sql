-- Add the Sol Medium OpenCode API-auth treatment to the shared gallery
-- leaderboard. The timed evaluation used a dedicated project, paused before
-- this post-benchmark retrofit.

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
    'a2a_async_streaming_opencode',
    'monolith_sol_medium',
    'monolith_opencode',
    'monolith_sol_medium_opencode',
    'monolith_sol_low_opencode',
    'monolith_sol_high_opencode',
    'monolith_luna_xhigh_opencode',
    'monolith_luna_high_opencode',
    'monolith_luna_max_codex_minimal',
    'monolith_luna_max_opencode_retest',
    'monolith_luna_xhigh_fast_opencode',
    'monolith_luna_max_fast_opencode',
    'monolith_luna_xhigh_opencode_control',
    'monolith_sol_low_fast_opencode',
    'monolith_sol_medium_fast_opencode',
    'monolith_grok_4_5_medium_cursor',
    'monolith_grok_4_5_high_cursor',
    'monolith_grok_4_5_medium_fast_cursor',
    'monolith_grok_4_5_high_fast_cursor',
    'monolith_auto_cursor',
    'monolith_sol_medium_opencode_api'
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
      'a2a_async_streaming_opencode',
      'monolith_sol_medium',
      'monolith_opencode',
      'monolith_sol_medium_opencode',
      'monolith_sol_low_opencode',
      'monolith_sol_high_opencode',
      'monolith_luna_xhigh_opencode',
      'monolith_luna_high_opencode',
      'monolith_luna_max_codex_minimal',
      'monolith_luna_max_opencode_retest',
      'monolith_luna_xhigh_fast_opencode',
      'monolith_luna_max_fast_opencode',
      'monolith_luna_xhigh_opencode_control',
      'monolith_sol_low_fast_opencode',
      'monolith_sol_medium_fast_opencode',
      'monolith_grok_4_5_medium_cursor',
      'monolith_grok_4_5_high_cursor',
      'monolith_grok_4_5_medium_fast_cursor',
      'monolith_grok_4_5_high_fast_cursor',
      'monolith_auto_cursor',
      'monolith_sol_medium_opencode_api'
    )
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 16
    and player_name !~ '[[:cntrl:]]'
    and score between 0 and 2147483647
  );

comment on column public.leaderboard.candidate_id is
  'Benchmark treatment partition for the twenty-seven timed-run gallery candidates.';
