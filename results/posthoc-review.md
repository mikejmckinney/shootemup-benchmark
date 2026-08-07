# Post-hoc regression review

This supplemental review covers all 1 preserved candidates. Browser checks ran against every timed-run deployment; non-deploying timed candidates received explicit not-applicable records because the affected categories had already scored zero. Supabase REST calls were fulfilled inside the browser, so the audit wrote no leaderboard rows and did not modify candidate source or deployments.

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
| monolith_sol_medium_opencode_api | 93 | 4 | -4 | 89 | -9 |

Original automated and manual evidence is retained unchanged. Per-candidate browser evidence is in `results/evidence/<candidate>/posthoc-regressions.json`; the derived adjustment is in `posthoc-score.json`.
