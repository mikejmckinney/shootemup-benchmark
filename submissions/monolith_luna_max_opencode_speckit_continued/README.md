# Neon Barrage

Neon Barrage is a single-player browser shoot-'em-up with a deterministic canvas
engine and a public, RLS-protected leaderboard.

## Local Setup

Requirements: Node.js 20 or newer, npm, and a Chromium browser for browser tests.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` when a
leaderboard project is available. Management or service-role credentials must never
be placed in `.env.local` or browser-visible variables.

## Controls

- Arrow keys or WASD move the ship.
- Space fires.
- Touch controls provide movement and firing on narrow viewports.
- Sound begins after user interaction and is controlled by the visible mute button.
- Game over exposes a final score, name validation, submission, and restart.

## Architecture

- `src/game/` contains pure session transitions, collision rules, input normalization,
  rendering, and optional audio.
- `src/components/` contains semantic DOM controls, HUD, canvas integration, form
  state, leaderboard states, and responsive presentation.
- `src/leaderboard/` contains client-side validation and the public Supabase client.
- `supabase/migrations/` is the reproducible remote schema and RLS policy source.
- `src/test-adapter.ts` exposes the required narrow production adapter while routing
  test game-over through the same score UI as normal play.

## Quality Gates

```sh
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
```

The unit and integration tests cover game transitions, collision, validation,
leaderboard ordering, application state, and migration policy text. Playwright covers
the production selectors and adapter. The full validation sequence is in
`specs/001-neon-barrage-shooter/quickstart.md`.

## Security Decisions

- The browser uses only the public Supabase URL and anonymous key.
- `public.leaderboard_entries` enables RLS and grants anonymous select plus insert of
  `name` and `score` only.
- Database constraints repeat client validation for trimmed names, control characters,
  and integer score bounds.
- Identity and timestamp fields are server-managed; anonymous update/delete are absent.
- Names render as text and network errors do not expose protected data.

### User Story 2 Checkpoint

The validated submission flow, deterministic top-10 ordering, loading/empty/error
states, public client boundary, and migration policy contract pass the local test suite.
Remote schema application and real persistence remain release gates.

### User Story 3 Checkpoint

The desktop and narrow-viewport browser checks pass for keyboard focus, named controls,
touch controls, live score/lives status, mute state, and reduced-motion rendering. Audio
creation is lazy and failure-safe; it begins only after a user interaction.

## Deployment

Create a new Supabase project in organization `xfbsknprvxldvgioaows` and a
treatment-prefixed Cloudflare Pages project. Keep management credentials in the
execution environment only, mapping `SUPABASE_API_KEY` to the CLI token variable and
`CLOUDFLARE_API_KEY` to the Wrangler token variable when required.

Apply the migration and deploy the static build:

```sh
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
npm run build
npx wrangler pages deploy dist --project-name "$CLOUDFLARE_PROJECT"
```

The project and deployment names must begin with `shootemup-bench-<treatment>-`.
Do not pause the Supabase project; the benchmark controller performs that action after
verification.

## Evidence

Run the public smoke and persistence check with the actual deployment URL:

```sh
npm run verify:production -- "$CLOUDFLARE_URL"
```

Write `benchmark-result.json` only from observed production values. Its status may be
`complete` only when the public URL responds successfully, the real public insert/read
round trip survives reload, all required tests pass, and no secret is present.

## Verified Release

- Pages URL: `https://shootemup-bench-monolith-luna-max-opencode-speckit-pages.pages.dev`
- Production verification: HTTP 200, public score insert/read/reload, and bundle audit passed.
- Local gates: lint, typecheck, 24 unit/integration tests, build, and 3 local browser tests passed.
- Production browser gate: 4 Playwright tests passed.
- Dependency audit: `npm audit --audit-level=low` reports zero vulnerabilities.
- RLS audit: enabled; anonymous select plus `name`/`score` insert only; invalid insert rejected with HTTP 400 and update/delete rejected with HTTP 401.
- Runtime sample: 61 animation frames averaged 16.945 ms per frame; maximum observed frame was 33.3 ms.

### User Story 1 Checkpoint

The core game loop and production test adapter are validated by the engine, collision,
and browser contract tests. Leaderboard persistence and accessibility remain release
gates for the complete benchmark objective.
