# Shoot-'Em-Up agent architecture benchmark results

Generated from retained run, evaluator, judge, and cleanup JSON. There is one replicate per treatment, so these are controlled case-study results rather than population estimates.

## Result

Quality is an open-ended score using the original monolith as the comparison baseline. Its original score was 100; the uniform post-hoc review corrects it to **98**. It is not a percentage and 100 is not a ceiling.

Scores include the uniform [post-hoc regression review](posthoc-review.md). Original automated and manual evidence remains unchanged; absolute post-hoc deductions are applied directly.

| Candidate | Score | Gate | Cost | Time | Total tokens | Cached input | Uncached input | Cache writes | Output | Gate-adjusted ROI |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Monolith · Luna Xhigh · OpenCode control | 92 | PASS | $0.0568 | 10:04 | 0.667M | 0.579M | 0.061M | 0.000M | 0.027M | 121.6679 |
| Monolith · Luna Xhigh Fast · OpenCode | 96 | PASS | $0.1198 | 6:11 | 0.944M | 0.879M | 0.000M | 0.038M | 0.027M | 111.5295 |
| Monolith · Luna Xhigh · OpenCode | 95 | PASS | $0.0753 | 12:02 | 1.308M | 1.209M | 0.068M | 0.000M | 0.031M | 99.7933 |
| Monolith · Luna Max · OpenCode | 95 | PASS | $0.0901 | 13:17 | 1.588M | 1.469M | 0.081M | 0.000M | 0.037M | 86.8382 |
| Monolith · Luna Max · Codex Minimal Context | 97 | PASS | $0.1159 | 15:54 | 2.242M | 2.093M | 0.104M | 0.000M | 0.044M | 71.4548 |
| Monolith · Luna Max Fast · OpenCode | 93 | PASS | $0.1968 | 10:10 | 1.887M | 1.788M | 0.000M | 0.060M | 0.040M | 65.7418 |
| Monolith · Luna Max · OpenCode fresh control | 94 | PASS | $0.1224 | 17:56 | 2.514M | 2.371M | 0.097M | 0.000M | 0.046M | 63.4561 |
| Monolith · Auto Cost · Cursor | 95 | PASS | $0.3919 | 5:58 | 0.627M | 0.500M | 0.104M | 0.000M | 0.023M | 62.1225 |
| Monolith · Luna Max · warm cache | 92 | PASS | $0.1513 | 17:37 | 3.656M | 3.482M | 0.127M | 0.000M | 0.047M | 56.3601 |
| Monolith · Sol Low Fast · OpenCode | 94 | PASS | $1.0582 | 3:51 | 0.269M | 0.239M | 0.000M | 0.020M | 0.010M | 46.5718 |
| Monolith · Grok 4.5 High · Cursor | 94 | PASS | $0.7349 | 6:38 | 0.851M | 0.708M | 0.120M | 0.000M | 0.024M | 42.5742 |
| A2A · async streaming · Luna Max · OpenCode | 96 | PASS | $0.3521 | 18:43 | 8.050M | 7.594M | 0.347M | 0.000M | 0.109M | 37.3969 |
| Monolith · Grok 4.5 Medium · Cursor | 91 | BORDERLINE | $0.5657 | 7:21 | 0.749M | 0.683M | 0.043M | 0.000M | 0.023M | 35.7020 |
| Monolith · Grok 4.5 Medium Fast · Cursor | 97 | PASS | $1.6384 | 4:43 | 1.019M | 0.935M | 0.058M | 0.000M | 0.026M | 34.8938 |
| Monolith · Grok 4.5 High Fast · Cursor | 96 | PASS | $1.5381 | 5:20 | 0.957M | 0.881M | 0.050M | 0.000M | 0.025M | 33.5177 |
| Monolith · Sol Medium · OpenCode | 94 | PASS | $1.0020 | 8:30 | 0.617M | 0.557M | 0.043M | 0.000M | 0.017M | 32.2100 |
| Monolith · Sol Medium Fast · OpenCode | 91 | BORDERLINE | $1.5558 | 3:54 | 0.392M | 0.350M | 0.000M | 0.027M | 0.014M | 29.5544 |
| Monolith · Luna Max · cold cache | 98 | PASS | $0.4754 | 28:47 | 16.570M | 16.246M | 0.269M | 0.000M | 0.056M | 26.4914 |
| A2A · asynchronous | 96 | PASS | $0.5825 | 24:02 | 14.666M | 14.071M | 0.433M | 0.000M | 0.162M | 25.6578 |
| A2A · synchronous | 93 | PASS | $0.6853 | 23:15 | 15.604M | 14.802M | 0.623M | 0.000M | 0.179M | 23.2986 |
| Monolith · Sol High · OpenCode | 94 | PASS | $1.6572 | 14:28 | 1.063M | 0.969M | 0.066M | 0.000M | 0.028M | 19.1979 |
| Monolith · Sol Low · OpenCode | 89 | BORDERLINE | $0.6749 | 5:29 | 0.310M | 0.264M | 0.034M | 0.000M | 0.012M | 18.5055 |
| Native isolated subagents | 90 | BORDERLINE | $0.5592 | 25:45 | 13.450M | 12.876M | 0.427M | 0.000M | 0.147M | 14.2301 |
| Monolith · Sol Medium · OpenCode API | 89 | BORDERLINE | $1.1060 | 7:47 | 0.786M | 0.736M | 0.000M | 0.033M | 0.018M | 12.1337 |
| Monolith · Sol Medium · Codex | 91 | BORDERLINE | $3.0659 | 12:17 | 3.573M | 3.435M | 0.112M | 0.000M | 0.025M | 11.8629 |
| Monolith · Opus 5 Medium · Claude Code | 95 | PASS | $4.0853 | 24:25 | 3.556M | 3.406M | 0.000M | 0.093M | 0.058M | 9.5119 |
| Monolith · Sonnet 5 Medium · Claude Code | 78 | FAIL | $1.5907 | 10:08 | 4.513M | 4.391M | 0.000M | 0.084M | 0.038M | 0.0000 |
| Monolith · Luna High · OpenCode | 73 | FAIL | $0.0421 | 7:12 | 0.655M | 0.594M | 0.043M | 0.000M | 0.018M | 0.0000 |
| Native dynamic subagents | 58 | FAIL | $0.5272 | 23:49 | 14.209M | 13.551M | 0.544M | 0.000M | 0.115M | 0.0000 |
| Monolith · Luna Max · OpenCode + AI Repo Template | 26 | FAIL | $0.6164 | 45:00 | 21.041M | 20.382M | 0.582M | 0.000M | 0.077M | 0.0000 |
| Dynamic · Luna Max · OpenCode + Superpowers | 9 | FAIL | $0.3852 | 45:00 | 6.369M | 5.643M | 0.599M | 0.000M | 0.127M | 0.0000 |
| Monolith · Luna Max · OpenCode + Spec Kit | 4 | FAIL | $0.4796 | 45:00 | 13.824M | 13.369M | 0.334M | 0.000M | 0.121M | 0.0000 |

Gate-adjusted ROI uses `score × clamp((score - 87) / 5, 0, 1) / sqrt(API cost × elapsed minutes)`. The gate factor is 1 for PASS, 0.2–0.8 for BORDERLINE, and 0 for FAIL. It is a comparative index, not conventional financial ROI. Total tokens are cached input + uncached input + cache writes + output. Reasoning tokens are included in output and are not counted twice. Rows are ranked by gate-adjusted ROI descending; Pareto analysis remains separate below.

- Highest observed quality: **Monolith · Luna Max · cold cache**.
- Quality-gate borderline: **Native isolated subagents, Monolith · Sol Medium · Codex, Monolith · Sol Medium · OpenCode API, Monolith · Sol Low · OpenCode, Monolith · Sol Medium Fast · OpenCode, Monolith · Grok 4.5 Medium · Cursor**.
- Quality-gate failures: **Native dynamic subagents, Monolith · Luna High · OpenCode, Monolith · Luna Max · OpenCode + Spec Kit, Dynamic · Luna Max · OpenCode + Superpowers, Monolith · Luna Max · OpenCode + AI Repo Template, Monolith · Sonnet 5 Medium · Claude Code**.
- Pareto frontier at ε=2: **Monolith · Luna Xhigh · OpenCode control, Monolith · Luna Xhigh Fast · OpenCode, Monolith · Luna Xhigh · OpenCode, Monolith · Auto Cost · Cursor, Monolith · Sol Low Fast · OpenCode, Monolith · Grok 4.5 Medium Fast · Cursor**.
- Highest gate-adjusted ROI: **Monolith · Luna Xhigh · OpenCode control (121.6679)**.

## Quality-tolerance frontier sensitivity

Strict Pareto dominance uses the observed scores exactly. The ε analysis treats a candidate up to ε points lower as no worse on quality, then applies cost/time dominance. It is a practical-equivalence sensitivity—not a confidence interval or proof that score differences are noise—and the relation need not be transitive.

| Quality tolerance ε | Frontier among gate survivors | Drops from strict frontier |
|---:|---|---|
| 0 | Monolith · Luna Max · cold cache, Monolith · Luna Xhigh · OpenCode, Monolith · Luna Max · Codex Minimal Context, Monolith · Luna Xhigh Fast · OpenCode, Monolith · Sol Low Fast · OpenCode, Monolith · Grok 4.5 Medium Fast · Cursor, Monolith · Grok 4.5 High Fast · Cursor, Monolith · Auto Cost · Cursor, Monolith · Luna Xhigh · OpenCode control | — |
| 2 | Monolith · Luna Xhigh · OpenCode, Monolith · Luna Xhigh Fast · OpenCode, Monolith · Sol Low Fast · OpenCode, Monolith · Grok 4.5 Medium Fast · Cursor, Monolith · Auto Cost · Cursor, Monolith · Luna Xhigh · OpenCode control | Monolith · Luna Max · cold cache, Monolith · Luna Max · Codex Minimal Context, Monolith · Grok 4.5 High Fast · Cursor |
| 3 | Monolith · Luna Xhigh Fast · OpenCode, Monolith · Sol Low Fast · OpenCode, Monolith · Auto Cost · Cursor, Monolith · Luna Xhigh · OpenCode control | Monolith · Luna Max · cold cache, Monolith · Luna Xhigh · OpenCode, Monolith · Luna Max · Codex Minimal Context, Monolith · Grok 4.5 Medium Fast · Cursor, Monolith · Grok 4.5 High Fast · Cursor |

At ε=2, A2A asynchronous is dominated because Luna Xhigh OpenCode is within one quality point while being 7.7× cheaper and exactly 12:00 faster. ε=2 is the headline frontier and ε=0 and ε=3 are reported as sensitivities; none was preregistered for these runs.

## Quality-adjusted efficiency sensitivity

PAYG-equivalent costs use [official OpenAI API rates](https://developers.openai.com/api/docs/pricing), [Cursor model rates](https://cursor.com/docs/models-and-pricing), and [official Anthropic API rates](https://platform.claude.com/docs/en/about-claude/pricing) current on 2026-08-10. Standard Luna costs **$0.20/M uncached input, $0.02/M cached input, $0.25/M cache writes, and $1.20/M output**; Fast Luna doubles those rates. Standard Sol costs **$5.00/M, $0.50/M, $6.25/M, and $30.00/M**; Priority Sol doubles them. Cursor Grok 4.5 Standard costs **$2.00/M uncached input, $0.50/M cache reads, $0 cache writes, and $6.00/M output**; Fast costs **$4.00/M, $1.00/M, $0, and $18.00/M**. Cursor Auto Cost uses **$1.25/M uncached/cache-write input, $0.25/M cache reads, and $6.00/M output**. Opus 5 uses **$5.00/M input, $0.50/M cache reads, $6.25/M 5-minute cache writes, $10.00/M 1-hour cache writes, and $25.00/M output**. Sonnet 5 uses its introductory through-August-31 rates of **$2.00/M, $0.20/M, $2.50/M, $4.00/M, and $10.00/M**, respectively. Captured web searches add $0.01 each. Supabase and Cloudflare free-tier usage adds $0 marginal infrastructure cost.

For a stated value of unattended agent time `r` in USD per minute:

`quality-adjusted efficiency(r) = quality score / (API cost + elapsed minutes × r)`

| Candidate | $0/h | $3/h | $10/h | $11.79/h Max/Medium tie | $16.33/h Xhigh/Medium tie | $25/h | $60/h |
|---|---:|---:|---:|---:|---:|---:|---:|
| Monolith · Luna Xhigh · OpenCode control | 1619.76 | 164.25 | 53.04 | 45.19 | 32.89 | 21.64 | 9.09 |
| Monolith · Luna Xhigh Fast · OpenCode | 801.18 | 223.78 | 83.45 | 71.89 | 53.24 | 35.61 | 15.23 |
| Monolith · Luna Xhigh · OpenCode | 1261.43 | 140.33 | 45.65 | 38.92 | 28.35 | 18.67 | 7.85 |
| Monolith · Luna Max · OpenCode | 1054.40 | 125.95 | 41.23 | 35.17 | 25.63 | 16.89 | 7.10 |
| Monolith · Luna Max · Codex Minimal Context | 836.93 | 106.49 | 35.07 | 29.92 | 21.82 | 14.39 | 6.06 |
| Monolith · Luna Max Fast · OpenCode | 472.48 | 131.88 | 49.17 | 42.36 | 31.37 | 20.98 | 8.97 |
| Monolith · Luna Max · OpenCode fresh control | 768.21 | 92.24 | 30.21 | 25.77 | 18.78 | 12.38 | 5.21 |
| Monolith · Auto Cost · Cursor | 242.39 | 137.63 | 68.52 | 60.71 | 47.11 | 33.01 | 14.94 |
| Monolith · Luna Max · warm cache | 608.25 | 89.14 | 29.80 | 25.45 | 18.60 | 12.28 | 5.18 |
| Monolith · Sol Low Fast · OpenCode | 88.83 | 75.16 | 55.30 | 51.79 | 44.63 | 35.31 | 19.15 |
| Monolith · Grok 4.5 High · Cursor | 127.91 | 88.13 | 51.07 | 46.10 | 37.00 | 26.87 | 12.76 |
| A2A · async streaming · Luna Max · OpenCode | 272.66 | 74.54 | 27.65 | 23.81 | 17.62 | 11.78 | 5.03 |
| Monolith · Grok 4.5 Medium · Cursor † | 160.86 | 97.51 | 50.82 | 45.26 | 35.45 | 25.08 | 11.50 |
| Monolith · Grok 4.5 Medium Fast · Cursor | 59.21 | 51.76 | 40.01 | 37.81 | 33.19 | 26.92 | 15.26 |
| Monolith · Grok 4.5 High Fast · Cursor | 62.41 | 53.19 | 39.55 | 37.11 | 32.11 | 25.53 | 13.97 |
| Monolith · Sol Medium · OpenCode | 93.81 | 65.87 | 38.86 | 35.17 | 28.35 | 20.69 | 9.89 |
| Monolith · Sol Medium Fast · OpenCode † | 58.49 | 51.98 | 41.25 | 39.18 | 34.77 | 28.61 | 16.68 |
| Monolith · Luna Max · cold cache | 206.12 | 51.19 | 18.59 | 15.98 | 11.79 | 7.86 | 3.35 |
| A2A · asynchronous | 164.81 | 53.81 | 20.92 | 18.09 | 13.47 | 9.06 | 3.90 |
| A2A · synchronous | 135.71 | 50.33 | 20.39 | 17.69 | 13.26 | 8.97 | 3.89 |
| Monolith · Sol High · OpenCode | 56.72 | 39.49 | 23.11 | 20.88 | 16.80 | 12.23 | 5.83 |
| Monolith · Sol Low · OpenCode † | 131.87 | 93.77 | 56.02 | 50.77 | 41.06 | 30.07 | 14.45 |
| Native isolated subagents † | 160.93 | 48.73 | 18.55 | 16.01 | 11.89 | 7.97 | 3.42 |
| Monolith · Sol Medium · OpenCode API † | 80.47 | 59.53 | 37.03 | 33.76 | 27.60 | 20.46 | 10.01 |
| Monolith · Sol Medium · Codex † | 29.68 | 24.73 | 17.80 | 16.60 | 14.20 | 11.12 | 5.93 |
| Monolith · Opus 5 Medium · Claude Code | 23.25 | 17.90 | 11.65 | 10.69 | 8.85 | 6.66 | 3.33 |
| Monolith · Sonnet 5 Medium · Claude Code † | 49.03 | 37.19 | 23.78 | 21.77 | 17.93 | 13.42 | 6.65 |
| Monolith · Luna High · OpenCode † | 1734.62 | 181.55 | 58.77 | 50.09 | 36.46 | 24.00 | 10.08 |
| Native dynamic subagents † | 110.02 | 33.76 | 12.90 | 11.13 | 8.27 | 5.55 | 2.38 |
| Monolith · Luna Max · OpenCode + AI Repo Template † | 42.18 | 9.07 | 3.20 | 2.75 | 2.02 | 1.34 | 0.57 |
| Dynamic · Luna Max · OpenCode + Superpowers † | 23.36 | 3.42 | 1.14 | 0.97 | 0.71 | 0.47 | 0.20 |
| Monolith · Luna Max · OpenCode + Spec Kit † | 8.34 | 1.47 | 0.50 | 0.43 | 0.31 | 0.21 | 0.09 |

Rows retain the main table's gate-adjusted-ROI order; compare columns to see how the stated time value changes the result.

† Is BORDERLINE or FAIL and is not eligible to win a scenario. Values remain visible for diagnostic transparency.

Across the current quality-eligible frontier, Luna Xhigh OpenCode and Sol Medium OpenCode tie at **$0.272247/minute ($16.33/hour)**. Below that time value Luna Xhigh is preferred; above it Sol Medium is preferred. The earlier Luna Max/Sol Medium crossover remains **$11.79/hour**.

This is a sensitivity analysis, not conventional financial ROI. API cost is a list-price estimate rather than an invoice; subscription, OAuth, contract, regional, service-tier, and tool billing can differ.

## Marginal utility versus designated comparator

The original cold monolith remains the architectural comparator for the original treatments. Minimal-context Codex instead uses warm-cache Codex to reduce dependency/tool-installation confounding. Spec Kit, Superpowers, and AI Repo Template use the fresh Luna Max OpenCode control; AI Repo Template ran later, so its comparison has additional sequential-run drift.

| Candidate | Comparator | Δ score | Δ cost | Δ total tokens | Δ wall time |
|---|---|---:|---:|---:|---:|
| Native dynamic subagents | Monolith · Luna Max · cold cache | -40 | +0.0517 | -2.361M | -4:58 |
| Native isolated subagents | Monolith · Luna Max · cold cache | -8 | +0.0838 | -3.120M | -3:02 |
| A2A · synchronous | Monolith · Luna Max · cold cache | -5 | +0.2099 | -0.966M | -5:32 |
| Monolith · Luna Max · warm cache | Monolith · Luna Max · cold cache | -6 | -0.3242 | -12.914M | -11:10 |
| A2A · asynchronous | Monolith · Luna Max · cold cache | -2 | +0.1070 | -1.904M | -4:45 |
| A2A · async streaming · Luna Max · OpenCode | A2A · asynchronous | 0 | -0.2304 | -6.616M | -5:19 |
| Monolith · Sol Medium · Codex | Monolith · Luna Max · cold cache | -7 | +2.5905 | -12.997M | -16:30 |
| Monolith · Luna Max · OpenCode | Monolith · Luna Max · cold cache | -3 | -0.3853 | -14.982M | -15:30 |
| Monolith · Sol Medium · OpenCode | Monolith · Luna Max · cold cache | -4 | +0.5265 | -15.953M | -20:17 |
| Monolith · Sol Medium · OpenCode API | Monolith · Sol Medium · OpenCode | -5 | +0.1040 | +0.169M | -0:43 |
| Monolith · Sol Low · OpenCode | Monolith · Luna Max · cold cache | -9 | +0.1995 | -16.260M | -23:18 |
| Monolith · Sol High · OpenCode | Monolith · Sol Medium · OpenCode | 0 | +0.6553 | +0.446M | +5:58 |
| Monolith · Luna Xhigh · OpenCode | Monolith · Luna Max · cold cache | -3 | -0.4001 | -15.261M | -16:45 |
| Monolith · Luna High · OpenCode | Monolith · Luna Max · cold cache | -25 | -0.4334 | -15.915M | -21:35 |
| Monolith · Luna Max · Codex Minimal Context | Monolith · Luna Max · warm cache | +5 | -0.0354 | -1.414M | -1:43 |
| Monolith · Luna Max · OpenCode fresh control | Monolith · Luna Max · cold cache | -4 | -0.3531 | -14.056M | -10:51 |
| Monolith · Luna Max · OpenCode + Spec Kit | Monolith · Luna Max · OpenCode fresh control | -90 | +0.3572 | +11.310M | +27:04 |
| Dynamic · Luna Max · OpenCode + Superpowers | Monolith · Luna Max · OpenCode fresh control | -85 | +0.2628 | +3.855M | +27:04 |
| Monolith · Luna Max · OpenCode + AI Repo Template | Monolith · Luna Max · OpenCode fresh control | -68 | +0.4940 | +18.527M | +27:04 |
| Monolith · Luna Xhigh Fast · OpenCode | Monolith · Luna Xhigh · OpenCode | +1 | +0.0445 | -0.364M | -5:51 |
| Monolith · Luna Max Fast · OpenCode | Monolith · Luna Max · OpenCode | -2 | +0.1067 | +0.299M | -3:07 |
| Monolith · Sol Low Fast · OpenCode | Monolith · Sol Low · OpenCode | +5 | +0.3832 | -0.042M | -1:38 |
| Monolith · Sol Medium Fast · OpenCode | Monolith · Sol Medium · OpenCode | -3 | +0.5538 | -0.225M | -4:36 |
| Monolith · Grok 4.5 Medium · Cursor | Monolith · Luna Max · cold cache | -7 | +0.0903 | -15.821M | -21:26 |
| Monolith · Grok 4.5 High · Cursor | Monolith · Grok 4.5 Medium · Cursor | +3 | +0.1692 | +0.102M | -0:43 |
| Monolith · Grok 4.5 Medium Fast · Cursor | Monolith · Grok 4.5 Medium · Cursor | +6 | +1.0727 | +0.270M | -2:38 |
| Monolith · Grok 4.5 High Fast · Cursor | Monolith · Grok 4.5 High · Cursor | +2 | +0.8032 | +0.106M | -1:18 |
| Monolith · Auto Cost · Cursor | Monolith · Luna Max · cold cache | -3 | -0.0835 | -15.943M | -22:49 |
| Monolith · Luna Xhigh · OpenCode control | Monolith · Luna Xhigh · OpenCode | -3 | -0.0185 | -0.641M | -1:58 |
| Monolith · Opus 5 Medium · Claude Code | Monolith · Luna Max · cold cache | -3 | +3.6099 | -13.013M | -4:22 |
| Monolith · Sonnet 5 Medium · Claude Code | Monolith · Opus 5 Medium · Claude Code | -17 | -2.4946 | +0.957M | -14:17 |

Negative cost/time values are savings; a negative score is a quality regression.

## Exploratory completion after timeout

These rows answer **“what did the methodologies eventually produce?”** They are not replacements for the primary 45-minute rows and are excluded from the main ranking. They reused warm state over multiple continuation windows, and Superpowers was stopped by the user before its own workflow declared completion.

| Candidate | Score calculation | Score | Gate | Cumulative cost | Cumulative time | Cumulative tokens | Gate-adjusted ROI |
|---|---:|---:|---|---:|---:|---:|---:|
| Monolith Luna Max OpenCode + Spec Kit | 52 + 41 − 2 | **91** | BORDERLINE | $1.1834 | 1:27:57 | 38.063M | 7.1358 |
| Dynamic Luna Max OpenCode + Superpowers | 48 + 43 − 2 | **89** | BORDERLINE | $2.3483 | 3:54:19 | 48.681M | 1.5176 |
| Monolith Luna Max OpenCode + AI Repo Template | 54 + 42 − 2 | **94** | PASS | $1.1844 | 1:05:31 | 42.209M | 10.6707 |

- **Spec Kit eventually delivered 91:** 52/54 automated + 41/46 manual − 2 post-hoc. It required 4.9× the control's wall time, 9.7× its estimated cost, and 15.1× its tokens and still scored three points below the fresh plain OpenCode control.
- **Superpowers stopped at 89:** 48/54 automated + 43/46 manual − 2 post-hoc. It required 13.1× the control's wall time, 19.2× its estimated cost, and 19.4× its tokens, equivalent to **5.2 full 45-minute candidate budgets**. The standardized evaluator could not move or fire with the keyboard, the immediate visible restart path failed, its handoff remained stale, and its parent branch never integrated the feature worktree. A later uncommitted fix wave is preserved but excluded from grading.
- **AI Repo Template eventually delivered 94:** 54/54 automated + 42/46 manual − 2 post-hoc. One additional 20:31 continuation brought its cumulative totals to 65:31, $1.1844, and 42.209M tokens. It matched the fresh control's corrected quality but required 3.7× the control's wall time, 9.7× its estimated cost, and 16.8× its tokens; the physical callsign-entry regression remains.
- The Superpowers deliverable therefore scored no better than Sol Low OpenCode's 89, which finished in 5:29, and scored below Sol Medium OpenCode's 94 at 8:30 and Luna Xhigh OpenCode's 95 at 12:02. Its partial quality-gate factor of 0.4 drives exploratory gate-adjusted ROI down to 1.5176.

[Play Spec Kit](https://shootemup-bench-monolith-luna-max-opencode-speckit-pages.pages.dev) · [Spec Kit continued source](../submissions/monolith_luna_max_opencode_speckit_continued/) · [Spec Kit continuation evidence](../results/continuations/monolith_luna_max_opencode_speckit/attempt-1/evidence/) · [Spec Kit score](../results/continuations/monolith_luna_max_opencode_speckit/attempt-1/score.json)

[Play Superpowers](https://shootemup-bench-dynamic-luna-max-opencode-superpowers-avwr.pages.dev/) · [Superpowers continued source](../submissions/dynamic_luna_max_opencode_superpowers_continued/) · [Superpowers continuation evidence](../results/continuations/dynamic_luna_max_opencode_superpowers/completed/evidence/) · [Superpowers score](../results/continuations/dynamic_luna_max_opencode_superpowers/completed/score.json)

[Play AI Repo Template](https://shootemup-bench-luna-max-opencode-ai-neon-barrage.mikejmckinney.workers.dev) · [AI Repo Template continued source](../submissions/monolith_luna_max_opencode_ai_repo_template_continued/) · [AI Repo Template continuation evidence](../results/continuations/monolith_luna_max_opencode_ai_repo_template/attempt-1/evidence/) · [AI Repo Template score](../results/continuations/monolith_luna_max_opencode_ai_repo_template/attempt-1/score.json)

All three methodology continuation databases are confirmed inactive. Their frontends remain available, but their leaderboards require an owner-authorized database resume. This does not affect the retained evaluation evidence.


## Key observations

- The warm-cache monolith cut the cold monolith from 28:47 to 17:37; their corrected scores are 92 and 98, respectively.
- Asynchronous A2A has a corrected score of 96 with exactly two accepted tasks, polling to terminal success, stable idempotency keys, and no resubmissions. It improved over synchronous A2A's retry-heavy protocol, but is dominated on the headline ε=2 frontier.
- Asynchronous-streaming A2A in OpenCode also scored 96. It finished 5:19 faster, cost 40% less, and used 45% fewer tokens than asynchronous-polling A2A. Runtime changed from Codex to OpenCode, and retained resubscriptions yielded task snapshots rather than incremental status/artifact events, so this does not isolate or validate streaming's causal contribution.
- Sol Medium in Codex was the fastest Codex treatment at 12:17 and has a corrected score of 91; its higher per-token price partly offsets that speed.
- The original Luna Max and Sol Medium OpenCode runs have effectively tied observed quality. Luna is about 11× cheaper; Sol is 4:47 faster. Luna is preferred whenever unattended agent time is valued below $11.79/hour.
- The API-authenticated Sol Medium OpenCode run finished 0:43 faster than its OAuth comparator (8.4%), but scored -5, cost 10.4% more, and used 27.5% more tokens. Its gate-adjusted ROI was 12.1337 versus 32.2100. With one run per authentication mode, this is evidence of no substantial overall API-key improvement—not proof that authentication caused the quality difference.
- The requested reasoning-effort extension produced corrected scores of 89 for Sol Low, 95 for Luna Xhigh, and 73 for Luna High.
- Luna Xhigh Fast finished 38.6% faster than its contemporaneous standard-tier control, scored +4, and cost 2.1× as much. Its gate-adjusted ROI was 8.3% lower.
- Luna Max Fast finished 23.5% faster than the original standard-tier Luna Max OpenCode run, scored -2, and cost 2.2× as much. Its gate-adjusted ROI was 24.3% lower.
- The corrected Fast harness isolated OpenCode's credential store, confirmed Priority service in both request and response events, and rejects API-key runs with zero provider-reported cost. The two valid Fast ledgers reported $0.119823 and $0.196836; both match the compiler's token calculation within 1%.
- Sol Low Fast completed 29.8% faster than standard Sol Low, scored +5, and cost 1.6× as much. Its gate-adjusted ROI increased from 18.5055 to 46.5718 because the quality improvement moved it from BORDERLINE to PASS.
- Sol Medium Fast completed 54.1% faster than standard Sol Medium, but scored -3 and cost 1.6× as much; its gate-adjusted ROI fell from 32.2100 to 29.5544.
- Cursor Grok Medium Fast completed 35.8% faster than standard Medium and scored +6, but cost 2.9× as much. Its gate-adjusted ROI was 2.3% lower.
- Cursor Grok High Fast completed 19.6% faster than standard High and scored +2, but cost 2.1× as much. Its gate-adjusted ROI was 21.3% lower.
- Standard Cursor Grok High beat Medium by +3 quality points and 0:43 while costing 30% more; its gate-adjusted ROI was 19.2% higher.
- Cursor Auto Cost delivered the best ROI in the seven-candidate extension: score 95, time 5:58, cost $0.3919, and gate-adjusted ROI 62.1225. Cursor confirmed the Auto router selection but did not expose its downstream model or tier, so the result is attributed only to Auto Cost.
- Sol High OpenCode tied Sol Medium OpenCode at 94, but took 5:58 longer, cost 65% more, used 72% more tokens, and achieved lower gate-adjusted ROI (19.1979 vs 32.2100).
- Sol OpenCode used about 2.6× fewer total tokens, but Sol's per-token Standard price is 25× Luna's, so its estimated run cost remained much higher.
- Sol Medium Codex reported 5.8× as many total tokens as Sol Medium OpenCode. The local compiler is internally consistent, but provider-side reconciliation is required before treating this as a causal runtime-efficiency result.
- Against warm-cache Codex, Luna Max Codex Minimal Context scored +5, cost 23% less, finished 1:43 faster, used 39% fewer total tokens, and improved gate-adjusted ROI by 27%. This is the primary Codex comparison because both runs could reuse installed dependencies and tools.
- Luna Max OpenCode still leads Minimal Context: OpenCode cost 22% less, finished 2:37 faster, used 29% fewer total tokens, and achieved 22% higher gate-adjusted ROI, while Minimal Context scored two points higher.
- A2A asynchronous used 11.2× the tokens of Luna Xhigh OpenCode, but that comparison changes architecture, runtime, reasoning effort, and cache/order conditions simultaneously; it does not isolate coordination overhead.
- Native isolated coordination remained much stronger than unrestricted dynamic delegation in the original architecture set.
- Opus 5 Medium in Claude Code scored 95 in 24:25 for $4.0853, passing all automated production checks. Sonnet 5 Medium finished 14:17 faster and cost 61% less, but its hidden leaderboard result and broken primary restart flow reduced quality to 78, below the gate, and therefore zero gate-adjusted ROI.
- The fresh Luna Max OpenCode control delivered a corrected score of 94 in 17:56 for $0.1224. Spec Kit, full-methodology Superpowers, and AI Repo Template all exhausted 45:00 without a timed deployment, scoring 4, 9, and 26, respectively. All three receive zero gate-adjusted ROI because they fail the quality gate.
- Spec Kit used 5.5× the control's tokens while spending most of the run on specification artifacts. Superpowers used 2.5× the control's tokens; its six-agent implement-review-fix loop caught real engine defects but completed only two of seven planned tasks. AI Repo Template used 8.4× the control's tokens: template-seed onboarding and its inherited 398-check verification suite consumed about 20 minutes, and repeated local browser-tool recovery consumed the final deployment window despite a locally built and tested game.

## Interpretation limits

- One replicate per treatment; no confidence intervals or significance tests.
- Runs were sequential and shared tool/provider caches. Candidate 6 intentionally measures warm-cache behavior.
- Provider/network/provisioning variance was not controlled, and the extension order was not randomized.
- The score is evidence-based but uses one automated evaluator and one blinded model judge.
- The original audio check verified only that the mute control changed state; it did not verify audio-node creation, audible output, or combat-event sound coverage. A direct recheck confirmed candidate 15's sparse launch/game-over/submission tones, but equivalent instrumentation should be applied uniformly in replication.
- The supplemental regression weights refine existing categories post hoc; they were applied uniformly, but were defined after user-reported defects and should be preregistered in future runs.
- Quality-adjusted efficiency is reported as a sensitivity across explicit time values, not as one universal ROI. The appropriate scenario depends on the economic value of delivery latency.
- The rubric score is interval-like rather than proven ratio-scale. The quality gate reduces the risk of rewarding cheap failures, but efficiency ratios should be treated as scenario comparisons rather than literal ratios of value.
- The PASS/BORDERLINE/FAIL thresholds and the ε=2 headline Pareto frontier were chosen after these runs and should be preregistered for a replication; ε=3 is reported as a sensitivity. BORDERLINE means the decision is unresolved, not that candidates are proven statistically equivalent.
- OpenCode and Codex token telemetry come from different runtime event formats. The compiler converts both to cached input, uncached input, and output. The two API-key Fast runs now reconcile locally against provider-reported per-turn cost, but this does not reconcile the older OAuth OpenCode runs or Codex runs against provider billing records.
- Claude Code exposes cache creation separately from cache reads, so total-token accounting includes those disjoint cache-write tokens. Opus's official-rate estimate reconciles within 0.1% of Claude Code's terminal cost. Sonnet's $1.5907 estimate uses Anthropic's time-limited introductory list price, while Claude Code reported $2.3867; the 33% discrepancy is retained and flagged rather than silently substituting one source.
- The Sol Medium OpenCode API-versus-OAuth comparison has one run per authentication mode. The API run has request-level transport and provider-cost telemetry, while the older OAuth run does not; stochastic generation, provider load, and sequential execution remain confounders, so the comparison cannot establish an authentication-mode effect.
- The minimal-context treatment disables several optional Codex surfaces together and has one replicate. It shows that the default integration surface was not necessary for this successful run, but cannot estimate the marginal token contribution of skills, MCP, apps, project instructions, or workflow variation individually.
- The asynchronous-streaming A2A extension changes transport and runtime together. Its improvement over asynchronous-polling A2A cannot be attributed specifically to streaming, OpenCode, cache/order conditions, or their interaction.
- The streaming harness retained task snapshots but no incremental status or artifact updates; terminal completion was recovered from final task snapshots. Sustained end-to-end stream behavior therefore remains unverified.
- The methodology extension intentionally measures each complete package, not isolated features. The failed deliveries do not establish that specifications, TDD, reviews, worktrees, repository onboarding, or subagents are individually harmful; they show that these three default full workflows did not fit this task's 45-minute budget in these single runs.
- The post-timeout continuation rows are exploratory, reused warm state, exceeded the preregistered time ceiling, and are excluded from the primary ranking. Superpowers was stopped by the user and graded at its last clean deployed commit, so its continuation row is an observed stopping point rather than a completed-methodology treatment.
- The first Spec Kit controller launch was excluded as a harness failure because initialization ran from the wrong working directory. It stopped after 26 seconds with zero model tokens and no external resources; all artifacts are retained under `results/harness-failures/`. The corrected run used a fresh repository and a new ephemeral no-cache installation, though transient OS/network caches cannot be perfectly reset.
- The results cover one full-stack game task and may not transfer to other work.

Every candidate Supabase project that was actually created was confirmed **INACTIVE** after evaluation. The former baseline project was later resumed as the shared gallery service; all 29 timed-run gallery games now use it with an allowlisted `candidate_id` partition, while the other benchmark-specific databases remain paused. Spec Kit and Superpowers created dedicated projects only during exploratory post-timeout continuations; AI Repo Template restored and reused its timed-run project. All three continuation databases are paused. These post-benchmark infrastructure states do not alter retained scores or timed metrics.
