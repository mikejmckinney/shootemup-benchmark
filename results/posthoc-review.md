# Post-hoc regression review

This supplemental review covers all 35 preserved candidates. Browser checks ran against every timed-run deployment; non-deploying timed candidates received explicit not-applicable records because the affected categories had already scored zero. Supabase REST calls were fulfilled inside the browser, so the audit wrote no leaderboard rows and did not modify candidate source or deployments.

## Checks and weights

The checks refine already-scored categories rather than add new categories:

| Check | Existing rubric allocation | Failure treatment |
|---|---:|---|
| Physical entry of `WASD wasd` in the callsign field | 2 of 6 leaderboard UI-submission points | Partial failure: submission remains possible with a restricted callsign |
| Progression indicator changes by no more than one immediately after launch | 1 of 2 HUD-state points | Partial failure: HUD exists but its initial state is inconsistent |
| An advertised `R` restart shortcut works immediately after submission | 1 of 2 restart points | Partial failure: primary click/touch restart is tested separately |
| A visible click/touch restart works immediately after submission | 2 restart points | Complete restart-path failure |

The original monolith remains the comparison baseline, but its discovered defects reduce its corrected score from 100 to 98. Scores are not normalized back to 100, and 100 is not a ceiling:

`corrected score = original score - candidate deductions`

## Corrected scores

| Candidate | Original score | Absolute deductions | Post-hoc adjustment | Corrected score | Δ corrected baseline |
|---|---:|---:|---:|---:|---:|
| monolith | 100 | 2 | -2 | 98 | 0 |
| native_dynamic | 58 | 0 | 0 | 58 | -40 |
| native_isolated | 92 | 2 | -2 | 90 | -8 |
| a2a | 93 | 0 | 0 | 93 | -5 |
| monolith_warm | 94 | 2 | -2 | 92 | -6 |
| a2a_async | 98 | 2 | -2 | 96 | -2 |
| a2a_async_streaming_opencode | 96 | 0 | 0 | 96 | -2 |
| monolith_sol_medium | 93 | 2 | -2 | 91 | -7 |
| monolith_opencode | 96 | 1 | -1 | 95 | -3 |
| monolith_sol_medium_opencode | 97 | 3 | -3 | 94 | -4 |
| monolith_sol_medium_opencode_api | 93 | 4 | -4 | 89 | -9 |
| monolith_sol_low_opencode | 93 | 4 | -4 | 89 | -9 |
| monolith_sol_high_opencode | 98 | 4 | -4 | 94 | -4 |
| monolith_luna_xhigh_opencode | 99 | 4 | -4 | 95 | -3 |
| monolith_luna_high_opencode | 75 | 2 | -2 | 73 | -25 |
| monolith_luna_max_codex_minimal | 99 | 2 | -2 | 97 | -1 |
| monolith_luna_max_opencode_retest | 98 | 4 | -4 | 94 | -4 |
| monolith_luna_max_opencode_speckit | 4 | 0 | 0 | 4 | -94 |
| dynamic_luna_max_opencode_superpowers | 9 | 0 | 0 | 9 | -89 |
| monolith_luna_xhigh_fast_opencode | 98 | 2 | -2 | 96 | -2 |
| monolith_luna_max_fast_opencode | 97 | 4 | -4 | 93 | -5 |
| monolith_sol_low_fast_opencode | 96 | 2 | -2 | 94 | -4 |
| monolith_sol_medium_fast_opencode | 95 | 4 | -4 | 91 | -7 |
| monolith_grok_4_5_medium_cursor | 93 | 2 | -2 | 91 | -7 |
| monolith_grok_4_5_high_cursor | 96 | 2 | -2 | 94 | -4 |
| monolith_grok_4_5_medium_fast_cursor | 99 | 2 | -2 | 97 | -1 |
| monolith_grok_4_5_high_fast_cursor | 98 | 2 | -2 | 96 | -2 |
| monolith_auto_cursor | 97 | 2 | -2 | 95 | -3 |
| monolith_luna_xhigh_opencode_control | 96 | 4 | -4 | 92 | -6 |
| monolith_luna_max_opencode_ai_repo_template | 26 | 0 | 0 | 26 | -72 |
| monolith_opus_5_medium_claude_code | 95 | 0 | 0 | 95 | -3 |
| monolith_sonnet_5_medium_claude_code | 78 | 0 | 0 | 78 | -20 |
| monolith_opus_5_medium_opencode | 100 | 0 | 0 | 100 | +2 |
| monolith_sonnet_5_medium_opencode | 75 | 2 | -2 | 73 | -25 |
| monolith_opus_5_medium_opencode_oauth | 100 | 0 | 0 | 100 | +2 |

Original automated and manual evidence is retained unchanged. Per-candidate browser evidence is in `results/evidence/<candidate>/posthoc-regressions.json`; the derived adjustment is in `posthoc-score.json`.
