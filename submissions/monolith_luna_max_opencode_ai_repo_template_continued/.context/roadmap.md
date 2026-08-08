# Neon Barrage Roadmap

> **Purpose**: Track the benchmark delivery stages without duplicating the
> detailed acceptance criteria in `BENCHMARK_TASK.md`.

## Delivery Stages

1. **Onboarding**: Complete. The inherited repository was inspected, adapted,
   and validated.
2. **Game implementation**: Complete. The canvas shooter includes keyboard and
   touch input, enemies, projectiles, collisions, score, lives, escalating
   difficulty, sound, game over, restart, and the production test adapter.
3. **Leaderboard persistence**: Complete. Supabase schema, RLS, database-side
   validation, public read/insert policies, and client states are deployed.
4. **Presentation and verification**: Complete. The design contract, local tests,
   required selectors, Cloudflare deployment, live gameplay, and live leaderboard
   round trip are verified.
5. **Handoff**: Complete in `benchmark-result.json`.

## Constraints

- Keep service-role and other secret credentials out of browser code.
- Preserve the stable selectors and production test adapter required by the
  benchmark brief.
- Use a resource name prefix of `shootemup-bench-<treatment>-` for new Cloudflare
  and Supabase resources.
- Do not claim a live deployment or leaderboard result without direct evidence.

## How To Update This Roadmap

Update stage status only when the corresponding user-visible outcome and its
supporting verification have actually landed. Keep detailed implementation
decisions in the relevant source, migration, or design documentation.
