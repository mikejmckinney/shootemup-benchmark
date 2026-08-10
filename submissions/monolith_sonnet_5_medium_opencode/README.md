# Neon Barrage

A neon-drenched, browser-based arcade shoot-'em-up built with TypeScript,
the HTML5 Canvas 2D API, and a Supabase-backed persistent leaderboard.
Deployed as static assets on Cloudflare Pages.

**Live URL:** see `benchmark-result.json` (`cloudflare_url`).

## Controls

- **Move:** Arrow keys or WASD
- **Fire:** Space (auto-fires while held)
- **Mute:** click the speaker icon in the top bar
- **Touch (mobile / coarse pointer):** on-screen thumb-stick (bottom-left) to
  move, FIRE button (bottom-right) to shoot. Controls appear automatically
  under 720px width or on touch devices (`[data-testid="touch-controls"]`).

## Gameplay

- Waves of drones, weavers (sinusoidal movers), and armored "brutes" spawn
  from the top of the screen with increasing frequency and speed as time
  passes (escalating difficulty).
- Enemies shoot aimed projectiles back at the player.
- 3 lives, brief invulnerability + flashing after taking a hit.
- Score increases per enemy kind destroyed (drone 10 / weaver 25 / brute 50).
- Game over triggers when lives reach 0; player can submit a callsign
  (1-16 chars) to the global leaderboard and see the current top 10.

## Architecture

- **Build tooling:** Vite + TypeScript (`vanilla-ts`-style, no framework) —
  chosen to keep the bundle small and the render loop fully in our control
  (`requestAnimationFrame` driven).
- **`src/game.ts`** — self-contained game engine: entity state (player,
  bullets, enemies, particles, starfield), update/physics/collision step,
  and canvas rendering. Exposes `getPublicState()` and `endGameForTest()`
  used by the black-box test adapter.
- **`src/audio.ts`** — Web Audio SFX synthesized at runtime (oscillators +
  filtered noise burst for explosions). No audio files, no autoplay: the
  `AudioContext` is only constructed inside a user-gesture handler
  (`ensureStarted()`), satisfying browser autoplay policies.
- **`src/supabaseClient.ts`** — thin wrapper around `@supabase/supabase-js`
  using only the public anon key (`VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`, injected at build time via Vite env vars). No
  service-role key ever ships to the browser.
- **`src/main.ts`** — wires up DOM/UI, keyboard/touch input, leaderboard
  rendering (loading/empty/error states), score submission, and installs
  `window.__NEON_BARRAGE__` for deterministic testing.
- **`supabase/migration.sql`** — reproducible schema + RLS policies.

### Test adapter

`window.__NEON_BARRAGE__` is always installed in production and drives the
same code paths as normal play:

```js
window.__NEON_BARRAGE__.getState();
// => { phase, score, lives, playerX, playerY, enemyCount, projectileCount }

window.__NEON_BARRAGE__.endGameForTest(1234);
// clamps to a non-negative integer, then calls the exact same
// triggerGameOver() path a real death would call — same game-over
// overlay, same submit-score form, same Supabase insert/validation.
```

## Local setup

```bash
npm install
cp .env.example .env   # fill in your own Supabase project URL + anon key
npm run dev             # http://localhost:5173
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` (typecheck) + production build to `dist/` |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests (`src/game.test.ts`) for game-state transitions (idle → playing → gameover, score/lives callbacks, `endGameForTest` clamping/idempotency) |
| `npm run preview` | Preview the production build locally |

## Deployment

### Cloudflare Pages (frontend)

```bash
npm run build
wrangler pages project create <project-name>
wrangler pages deploy dist --project-name <project-name> --branch main
```

Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are
baked into the static bundle at build time via Vite's `import.meta.env`;
they are public/anon values by design (see Security below).

### Supabase (database)

1. Create a project via the Supabase Management API or dashboard.
2. Apply `supabase/migration.sql` (e.g. via the SQL editor, the Management
   API `POST /v1/projects/{ref}/database/query`, or `supabase db push`
   against the project's connection string).
3. Copy the project's URL and **anon/public** key into `.env` /
   the Cloudflare Pages build environment.

## Security decisions

- **No secret key in the browser.** Only `VITE_SUPABASE_URL` and the anon
  (publishable) key are compiled into the client bundle. The service-role
  key is never referenced in `src/`, `.env.example`, or committed anywhere.
- **RLS enabled on every table** in the `public` schema (`leaderboard` is
  the only table). Policies:
  - `select` — allowed for `anon`/`authenticated`, unrestricted, because
    the leaderboard is intentionally public data.
  - `insert` — allowed for `anon`/`authenticated` **only** when the row
    satisfies the same shape the table itself enforces (name length 1-16,
    restricted charset, score in `[0, 100000000]`).
  - No `update`/`delete` policy exists, so those operations are denied by
    default under RLS — leaderboard entries are immutable once written.
  - Table `grant`s are minimized to `select, insert` on the table and
    `usage, select` on the identity sequence; broad default privileges are
    revoked first.
- **Database-level validation**, not just client-side: `CHECK` constraints
  on `player_name` (length + character class) and `score` (bounded
  non-negative integer) mean a network client bypassing the UI (or even
  bypassing RLS's `WITH CHECK`) still cannot insert malformed data — the
  constraints are enforced by Postgres regardless of the RLS policy logic.
- **Test adapter does not bypass validation.** `endGameForTest()` only
  transitions internal game state and reuses the exact same UI form / same
  `submitScore()` call as normal gameplay; it never talks to Supabase
  directly.
- Cloudflare Pages serves the app over HTTPS by default; no custom secrets
  are stored in the Pages project beyond the public Supabase URL/anon key.

## Known limitations / follow-ups

- Leaderboard name uniqueness is not enforced (multiple entries per name
  are allowed, matching a classic arcade high-score table).
- No rate limiting on inserts beyond RLS/CHECK constraints; a production
  hardening pass could add a Postgres function + `SECURITY DEFINER` RPC
  with server-side throttling if abuse becomes a concern.
