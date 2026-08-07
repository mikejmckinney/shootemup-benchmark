# Neon Barrage Design

## Goal

Build and deploy a polished, responsive browser shoot-'em-up named Neon Barrage. The
game must be playable without a backend, while completed scores can be validated and
persisted through a newly created Supabase project. The static frontend will be
deployed to Cloudflare Pages.

The benchmark objective is the approval authority for this autonomous run. The design
therefore makes reasonable decisions where the objective does not specify details:
vanilla TypeScript is preferred over a framework, the game uses a fixed logical canvas
viewport scaled by CSS, and the public leaderboard accepts trimmed names containing
letters, numbers, spaces, underscores, and hyphens.

## Alternatives Considered

### Vite and vanilla TypeScript (chosen)

Use Vite for a small production bundle and a pinned lockfile. Keep the game simulation
in a module that can be tested without a DOM, and keep DOM rendering, controls, audio,
and Supabase integration in thin adapters. This minimizes runtime overhead while still
providing a maintainable module boundary.

### React with a canvas child

React would make form and leaderboard state convenient, but it adds framework and
rendering coordination that is not useful for the real-time simulation. It increases
the amount of code and the chance that UI re-renders interfere with the animation
loop within the benchmark time limit.

### No-build HTML and CDN scripts

This would reduce local tooling, but it would make dependency pinning, type checking,
testing, and reliable production bundling weaker. It also makes the Supabase client
dependency less explicit. This is rejected despite its small initial footprint.

## Architecture

### Game engine

`src/game-engine.ts` owns the logical state and simulation. It exposes start/reset,
input updates, frame updates, firing, and a controlled test-only end-game transition.
The state includes `phase`, `score`, `lives`, player coordinates, enemy count, and
projectile count. Enemies spawn from a deterministic elapsed-time schedule, move
toward the player or down the playfield, and increase speed and spawn frequency as
score and elapsed time rise. Projectiles and enemies use simple circle/AABB collision
checks. Enemy hits reduce lives; a depleted life count transitions to game over.

The engine does not access the DOM, Web Audio, or Supabase. Its exported state is the
source for the HUD and for `window.__NEON_BARRAGE__.getState()`.

### Browser adapter and presentation

`src/main.ts` creates the canvas and engine, runs a `requestAnimationFrame` loop, and
renders the player, enemies, projectiles, starfield, hit effects, and HUD feedback.
The canvas has a fixed logical size and responsive CSS sizing so collision math is
stable on desktop and narrow screens. Keyboard listeners support Arrow keys and WASD;
Space fires. A touch control pad exposes directional buttons and fire, with pointer
events captured for mobile use.

The page uses a dark, high-contrast neon arcade visual system: cyan player and HUD
accents, magenta enemy accents, a restrained gradient background, readable uppercase
labels, and animated feedback for hits, waves, and game over. The layout keeps the
canvas and controls usable on small viewports and places the leaderboard beside or
below the game depending on available width.

The start control starts a new run, and the same control becomes a replay control
after game over. The game-over panel uses the score produced by normal play or the
test adapter. The mute control is always visible. An AudioContext is constructed or
resumed only from a user gesture, and all generated sounds honor the mute state.

### Leaderboard adapter

`src/leaderboard.ts` creates a Supabase browser client only when the Vite public
environment variables are present. It provides:

- a top-ten query ordered by score descending and creation time ascending;
- a score submission that trims and validates the name before inserting; and
- typed error results for configuration, network, validation, and database failures.

The UI loads the leaderboard independently of starting the game. It displays loading,
empty, and error states without disabling gameplay. On game over, the name form
accepts one to sixteen characters, reports validation errors inline, disables the
submit control while waiting, and reports network/database errors without losing the
score. A successful submission refreshes the top ten.

### Database and security

`supabase/migrations/20260806000000_create_leaderboard.sql` creates one exposed table,
`public.leaderboard_entries`, containing a UUID id, player name, integer score, and
creation timestamp. RLS is enabled. The anonymous role receives only `SELECT` and
`INSERT`; there are no public update or delete policies. The insert policy is limited
to anonymous clients and the table checks enforce a trimmed 1-16 character name with
no control characters and a non-negative, bounded integer score. The client uses only
the publishable anon key. No service-role or management credential is bundled into the
frontend or committed to the repository.

## Testability and Verification

The production page exposes this narrow adapter:

```js
window.__NEON_BARRAGE__ = {
  getState: () => ({ phase, score, lives, playerX, playerY, enemyCount, projectileCount }),
  endGameForTest: (score) => { /* validated non-negative integer */ }
};
```

`endGameForTest` validates its argument, changes the engine to the same game-over
state used by ordinary play, and opens the ordinary score-submission UI. It never
writes to Supabase directly or bypasses name/database validation.

Local tests use Vitest for meaningful engine behavior: movement bounds, firing and
projectile lifecycle, collision scoring, life loss/game-over, difficulty escalation,
and the test end-game transition. TypeScript checking and a Vite production build are
required commands. Production smoke verification checks HTTP 200, required stable
selectors, and the adapter string in the built page. A real Supabase insert followed
by an ordered read verifies persistence before the result artifact is written.

## Delivery

The app will be built with pinned npm dependencies and a committed lockfile. A
Cloudflare Pages project name will begin with
`shootemup-bench-dynamic-luna-max-opencode-superpowers-`, and the Supabase project
name will use the same required prefix. Production public configuration is supplied
at build time through `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; local secrets
remain ignored. `README.md` documents local setup, controls, architecture, security,
database migration, and deployment steps. The final `benchmark-result.json` contains
only the public Supabase URL/key and verified deployment metadata.

## Acceptance Criteria

1. The deployed page renders a responsive canvas shooter with enemies, projectiles,
   collisions, score, lives, escalating difficulty, game over, and restart.
2. Arrow/WASD movement, Space firing, and mobile touch controls work; sound has a
   visible mute control and starts only after interaction.
3. All required `data-testid` selectors and the production test adapter are present.
4. A valid 1-16 character name can submit a final non-negative integer score; the
   leaderboard shows at least the top ten when available and persists after reload.
5. Loading, empty, invalid input, missing configuration, and network/database errors
   are visible without making gameplay unplayable.
6. Supabase RLS and database constraints enforce the public minimum operations and
   validate names and scores server-side.
7. Local tests, type checking, production build, live HTTP status, and a real
   Supabase insert/read round trip pass before `benchmark-result.json` claims success.
