# Neon Barrage Roadmap

> **Purpose**: Track the benchmark delivery stages without duplicating the
> detailed acceptance criteria in `BENCHMARK_TASK.md`.

## Delivery Stages

1. **Onboarding**: Inspect the inherited repository, establish the design
   contract, run setup, and mark lifecycle state complete.
2. **Game implementation**: Add the real-time canvas shooter, keyboard and touch
   input, enemies, projectiles, collisions, score, lives, difficulty, sound,
   game-over flow, restart, and the production test adapter.
3. **Leaderboard persistence**: Create the Supabase schema and migration with
   RLS, database-side name/score validation, public read/insert operations, and
   client-side loading, empty, validation, and network-error states.
4. **Presentation and verification**: Apply the `DESIGN.md` contract, add local
   tests and the required selectors, build the static site, deploy it to
   Cloudflare, and verify the live leaderboard round trip.
5. **Handoff**: Write `benchmark-result.json` only after production HTTP and
   real Supabase insert/read verification succeed.

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
