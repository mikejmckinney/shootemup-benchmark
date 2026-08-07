# Neon Barrage

Neon Barrage is a responsive, canvas-based browser shoot-'em-up. Pilot the cyan
interceptor, clear descending enemy waves, protect three lives, and optionally
submit a completed run to a Supabase-backed top-ten leaderboard.

Task 5 covers local setup and documentation only. This repository does not claim
that a Supabase project has been provisioned, that Cloudflare Pages is live, or
that a production leaderboard round trip has been verified. Those checks belong
to the later deployment and verification tasks.

## Prerequisites

- Node.js 18 or newer.
- npm, included with Node.js.
- A Supabase project is required only for the persistent leaderboard. The game
  remains playable without public Supabase configuration.
- A Cloudflare account and Wrangler credentials are required only to deploy.

## Local Setup

Install the pinned dependencies:

```bash
npm install
```

Create a local environment file from the public template:

```bash
cp .env.example .env.local
```

Set these values in `.env.local` when a Supabase leaderboard is available:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

Both values are optional for local gameplay. If either is missing or invalid,
the game starts normally and the leaderboard reports that it is not configured.
`.env.local` is ignored by git. Vite embeds values whose names begin with
`VITE_` into the browser bundle, so only the Supabase project URL and
publishable anon key may be used there.

Start the Vite development server:

```bash
npm run dev
```

The server prints the local URL. For a LAN or browser smoke check, Vite can be
started with an explicit host, for example `npm run dev -- --host 127.0.0.1`.

## Commands

Run the complete local test suite:

```bash
npm test
```

Run strict TypeScript checking without emitting files:

```bash
npm run typecheck
```

Create the production bundle in `dist/`:

```bash
npm run build
```

Check the repository diff for whitespace errors:

```bash
git diff --check
```

The build script runs TypeScript checking before Vite creates the static
production assets.

## Controls

### Keyboard

- Arrow keys or `W`, `A`, `S`, and `D` move the interceptor.
- `Space` fires the weapon. Key repeat is suppressed so one key press creates
  one shot.
- The launch button starts a mission. After game over it becomes a replay
  control and starts a fresh run.
- `Sound On` / `Sound Off` toggles generated audio.

### Touch

The on-screen pad has `Up`, `Left`, `Down`, and `Right` buttons plus a `Fire`
button. Hold a direction to keep moving and release it to clear that input.
Pointer cancel, lost capture, window-level release, page blur, and hidden-page
changes all release active touch input. Touch controls remain available at all
widths, are visually emphasized below 760px, and use at least 44px base touch
targets with larger mobile controls where space permits.

## Game Mechanics

- The simulation uses a fixed logical 960x600 playfield. CSS scales the canvas
  while preserving its 8:5 aspect ratio, so collision and movement math remain
  stable across screen sizes.
- A new run begins with three lives. The player is bounded inside the field.
- Enemies spawn on an initial 1,000 ms interval. The interval decreases as the
  score rises and bottoms out at 300 ms. Enemy variants have different visual
  shapes and speeds; their speed also increases with score.
- Projectiles travel upward. A projectile hit removes one enemy and awards 100
  points. Enemy contact removes one life.
- When all lives are lost, the normal game-over path displays the final score,
  opens the callsign form, and allows replay. Callsigns are trimmed, must be
  1-16 characters, and cannot contain control characters. Scores must be
  non-negative integers no greater than 2,000,000,000.
- The leaderboard reads at most ten entries, ordering higher scores first and
  earlier creation times first for ties. A completed score is submitted only
  after client validation and is validated again by the database.

## Sound Interaction Rule

Neon Barrage uses short Web Audio oscillator tones for firing, hits, damage, and
game over. An `AudioContext` is created or resumed only from a user gesture:
starting/restarting a mission, firing, touching a control, or toggling mute. No
audio context is created during module initialization or an animation frame.
All generated tones honor the visible mute state, and unavailable or blocked
audio never interrupts gameplay.

## Responsive UI

The desktop layout places the game and mission/leaderboard sidebar in two
columns. At 980px and below, the sidebar stacks beneath the game. At 760px and
below, the HUD and mission actions stack, the launch button becomes full width,
touch controls become prominent, and the game-over form becomes one column. At
very narrow widths, score submission controls also stack. The canvas itself
keeps its logical dimensions while its CSS width follows the available panel.

## Source Architecture

- `index.html` contains the accessible application shell, canvas, HUD, mission
  controls, game-over form, touch controls, and leaderboard region.
- `src/game-engine.ts` is the DOM-free simulation. It owns phases, player input,
  spawning, movement, projectiles, swept collision checks, scoring, lives,
  difficulty, and game-over events.
- `src/main.ts` is the browser adapter. It owns the animation loop, canvas
  renderer, HUD/status updates, keyboard and pointer input, touch cleanup, Web
  Audio interaction, score form, and leaderboard rendering. Player names are
  inserted with `textContent`.
- `src/leaderboard.ts` validates callsigns and scores and creates a Supabase
  browser client only when both public Vite values are present. It loads the
  ordered top ten and submits validated rows with user-safe error results.
- `src/styles.css` defines the neon visual system, fixed-aspect canvas scaling,
  desktop/mobile breakpoints, focus states, and touch target sizing.
- `tests/game-engine.test.ts`, `tests/leaderboard.test.ts`, and
  `tests/presentation-contract.test.ts` cover simulation behavior, validation
  and migration contracts, request ordering, and stable browser-facing markup.

## Supabase Migration And Application

The database definition lives in `supabase/migrations/`:

1. `20260806000000_create_leaderboard.sql` creates
   `public.leaderboard_entries`, enables RLS, grants the anonymous role schema
   usage plus table `SELECT` and `INSERT`, and creates the public read and
   bounded anonymous insert policies.
2. `20260806000001_align_leaderboard_validation.sql` is the forward migration
   for databases that may already have the first migration. It replaces the
   validation constraints and anonymous insert policy with the current aligned
   rules while preserving historical rows through `NOT VALID` constraints.

Apply the files in timestamp order through the Supabase SQL editor, or use
`supabase db push` after linking this repository with a separately installed
and configured Supabase CLI. On a fresh database, apply both files in order so
the deployed schema matches the current repository state. Do not paste
management tokens into the SQL editor, repository, or frontend environment.

## RLS And Key Security

`public.leaderboard_entries` has Row Level Security enabled. The `anon` role is
allowed to read leaderboard rows and insert bounded rows only. There are no
anonymous update or delete grants or policies. Database constraints and the
insert policy enforce a trimmed 1-16 character name with no control characters
and an integer score from 0 through 2,000,000,000. The client-side checks are a
user experience layer, not a replacement for these server-side controls.

The Supabase anon/publishable key is designed to be exposed in a browser and
is safe to use only with the intended RLS boundary. Never put a service-role
key or any database password in a Vite variable, a static asset, or git.

`SUPABASE_API_KEY` and `CLOUDFLARE_API_KEY` are management credentials. They
must never be placed in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, any other
Vite environment variable, or a committed file. Hold them in the external
shell/CI or platform secret store, and do not print their values in command
output or reports.

## Cloudflare Pages Deployment

Cloudflare Pages serves the static Vite output. Configure a Pages project with:

- Build command: `npm run build`
- Build output directory: `dist`
- Build-time public variables: `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`

Set the two `VITE_` variables in the Pages project environment for the intended
production (and preview, if used) deployment. Do not set management tokens as
Vite variables. If Wrangler is authenticated through an externally managed
credential, the project can be created and deployed with commands like:

```bash
npx wrangler pages project create shootemup-bench-dynamic-luna-max-opencode-superpowers-neon-barrage --production-branch main
npx wrangler pages deploy dist --project-name shootemup-bench-dynamic-luna-max-opencode-superpowers-neon-barrage
```

The exact Pages URL and live HTTP result must be recorded only after deployment
and verification. This Task 5 work does not claim that either command has been
run successfully.

## Production Test Adapter

The browser entry point exposes a deliberately narrow test adapter at
`window.__NEON_BARRAGE__`:

```js
window.__NEON_BARRAGE__.getState()
// {
//   phase, score, lives, playerX, playerY, enemyCount, projectileCount
// }

window.__NEON_BARRAGE__.endGameForTest(1234)
```

`getState()` returns the public seven-field state snapshot. The test-only end
transition accepts only a non-negative integer, then uses the same game-over
rendering and score form as ordinary play. It does not write directly to
Supabase or bypass callsign, score, RLS, or database validation. A production
smoke test may use this adapter to open the normal submission UI, but a live
HTTP check and Supabase insert/read round trip are intentionally deferred to
Tasks 6 and 7.

## Verification Boundary

Before deployment, run the local hygiene and full checks:

```bash
npm test
npm run typecheck
npm run build
```

These commands verify the repository locally. They do not prove that a remote
Supabase project exists, that RLS has been applied to that project, that a
Cloudflare Pages URL responds with HTTP 200, or that a score survives a real
insert/read round trip. Those claims require the later deployment and live
verification work and must not be added to a result artifact beforehand.
