# Neon Barrage

Neon Barrage is a browser-based 2D arcade shoot-'em-up benchmark candidate.
The target experience is a short, replayable neon game with keyboard and touch
controls, generated sound, and a persistent public top-ten leaderboard backed by
Supabase. The benchmark brief in [`BENCHMARK_TASK.md`](BENCHMARK_TASK.md) is the
authoritative product contract.

> **For AI agents**: Read [`AGENTS.md`](AGENTS.md) for the operating contract,
> [`AI_REPO_GUIDE.md`](AI_REPO_GUIDE.md) for repository commands, and
> [`DESIGN.md`](DESIGN.md) before frontend implementation.

## Current Status

Repository onboarding establishes the inherited AI-collaboration baseline and
the product design contract. Application source, dependency manifests, and
deployment resources are not present yet; application delivery follows this
onboarding phase.

## Repo Map

The repository retains the template's separate audience surfaces. Humans use
this README for the product brief; agents use `AI_REPO_GUIDE.md` and `AGENTS.md`;
product direction lives in `.context/` and `DESIGN.md`; inherited process detail
and decisions remain under `docs/`.

| Location | Purpose |
|---|---|
| `BENCHMARK_TASK.md` | Product requirements, stable selectors, and final artifact contract |
| `DESIGN.md` | Product identity, visual tokens, responsive behavior, and accessibility floor |
| `.context/` | Product direction, roadmap, and design-artifact index |
| `AGENTS.md` | Always-loaded repository operating contract |
| `AI_REPO_GUIDE.md` | Agent-oriented commands, layout, and inherited workflow guidance |
| `scripts/` | Setup and environment verification tooling |
| `docs/` | Inherited process guides, ADRs, benchmark results, and research |

## Product Requirements

- Render a real-time 2D arcade shooter in a canvas.
- Support Arrow keys or WASD, Space firing, and touch controls on narrow screens.
- Include enemies, projectiles, collisions, score, lives, escalating difficulty,
  game over, restart, sound, and a visible mute control.
- Accept a 1-16 character name, persist scores in Supabase, and show at least
  the top ten in descending order.
- Keep all exposed tables protected by RLS and never ship a service-role key to
  the browser.
- Preserve the stable selectors and `window.__NEON_BARRAGE__` test adapter in
  `BENCHMARK_TASK.md`.

## Controls

- Keyboard: Arrow keys or WASD to move; Space to fire.
- Touch: Use the on-screen controls on narrow/mobile viewports.
- Sound: Use the visible mute control; audio must begin only after interaction.

## Target Architecture

- **Browser client**: Renders the game canvas, HUD, controls, game-over flow,
  and leaderboard states.
- **Supabase**: Stores validated public leaderboard rows and enforces RLS and
  database-side validation.
- **Cloudflare**: Serves the built static frontend from Pages or Workers static
  assets.
- **Secrets**: Browser code uses only a public Supabase key. Management keys,
  service-role keys, and deployment credentials stay outside the client bundle.

## Local Setup

The current onboarding command is:

```bash
./scripts/setup.sh
```

It installs dependencies only when a verified manifest exists, runs the
repository build when a build script exists, reports available pipeline
credentials without reading secret values, and finishes with
`./scripts/verify-env.sh --fix`. No application manifest or build command exists
in the current checkout yet.

The application phase must add its own local install, development, build, test,
and lint commands here after those commands are verified.

## Target Deployment Sequence

This sequence is a delivery-phase target and has not been run during onboarding:

1. Create a new Supabase project and apply the checked-in migration SQL.
2. Configure the frontend with the Supabase URL and public key only.
3. Build the static frontend and deploy it to Cloudflare Pages or Workers static
   assets using a resource name beginning with `shootemup-bench-<treatment>-`.
4. Verify production HTTP status and a real Supabase leaderboard insert/read
   round trip before writing `benchmark-result.json`.

## Verification

Run the inherited repository verification suite after setup:

```bash
./test.sh
```

Application tests, build, lint, and production outcome evidence must be added
and run during the delivery phase. Do not claim completion from static checks or
local mocks when the benchmark requires live deployment and persistence.

## Security Decisions

- Browser code may use only a Supabase publishable/anonymous client key.
- Supabase RLS must protect every exposed table and database constraints must
  validate names and plausible integer scores.
- Service-role keys, management credentials, and deployment secrets remain in
  local or hosted secret stores and are never committed or bundled.
- Production completion requires direct HTTP and real leaderboard insert/read
  evidence; local tests alone are insufficient.

## Inherited Workflow

The repository keeps the template's monolithic implementation model, blocking
CI checks, and optional advisory review tooling. Consult `AGENTS.md` and
`AI_REPO_GUIDE.md` for those rules; do not add a separate repo-local task board.

## License

MIT - inherited repository tooling is provided under the repository's existing
license.
