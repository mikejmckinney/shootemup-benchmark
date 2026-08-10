# Neon Barrage

A neon-drenched vertical shoot-'em-up that runs entirely in the browser on a 2D canvas, with a
persistent global leaderboard backed by Supabase and hosted on Cloudflare Pages.

- **Live:** https://shootemup-bench-monolith-opus-5-medium-opencode.pages.dev
- **Supabase project:** `jgmfieoslqsfmdjwmuru` (`https://jgmfieoslqsfmdjwmuru.supabase.co`)

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | `W A S D` or arrow keys | D-pad, or drag anywhere on the canvas |
| Fire | `Space` (hold for autofire) | `FIRE` button, or drag on canvas (autofire) |
| Start / restart | `Start run` button, `Space`, `Enter` | tap `Start run` |
| Mute | `M` or the speaker button | speaker button |
| Pause | `P` | — |

## Gameplay

Three enemy archetypes (drone, weaver, brute) stream in from the top and shoot aimed bolts.
A new wave arrives every 18 seconds: enemies get faster, spawn more often, fire more often, and
are worth more points. From wave 4 the player ship upgrades to a three-way spread. Three lives,
1.8 s of invulnerability after each hit, then game over with score submission and restart.

## Local setup

```bash
npm ci
cp .env.example .env      # fill in your Supabase URL + publishable key
npm run dev               # http://localhost:5173
```

Scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | production build into `dist/` |
| `npm test` | Vitest unit tests for the headless simulation and validation |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `node scripts/verify-production.mjs [url]` | Playwright black-box smoke test against the deployed site, including a real Supabase insert + reload persistence check |

## Architecture

```
index.html          markup, stable data-testid hooks, HUD, overlays, touch pad
src/game.ts         headless simulation (entities, physics, collisions, waves) — no DOM, unit tested
src/render.ts       canvas painter: glow, particles, starfield, grid, screen shake, vignette
src/audio.ts        Web Audio synth (oscillators + noise buffers); context created only on a user gesture
src/leaderboard.ts  PostgREST fetch wrapper with abort timeouts and typed errors
src/main.ts         input handling, HUD sync, overlays, submission flow, rAF loop, test adapter
src/style.css       responsive neon design system
supabase/migrations/0001_leaderboard.sql   remote schema + RLS policies
tests/game.test.ts  15 unit tests (lifecycle, movement, firing cadence, collisions, lives,
                    difficulty escalation, adapter behaviour, validation parity with the DB)
```

The simulation is deliberately DOM-free so game rules are testable in Node; rendering and input are
thin adapters over it. `game.update(dt, input)` is a pure step function over mutable state with a
deterministic xorshift RNG, which keeps tests stable.

### Test adapter

```js
window.__NEON_BARRAGE__.getState()          // { phase, score, lives, playerX, playerY, enemyCount, projectileCount }
window.__NEON_BARRAGE__.endGameForTest(n)   // forces the normal game-over UI with score n
```

`endGameForTest` floors/clamps its argument to a non-negative integer and then drives exactly the
same `onGameOver()` path as dying in game: the same overlay, the same name input, the same
validation and the same Supabase submission code. It never talks to the database directly.

### UI states handled

- **Loading** — "Loading leaderboard…" while the first fetch is in flight; refresh button disabled.
- **Empty** — "No scores yet — be the first pilot on the board."
- **Validation** — inline error for empty/too-long/illegal names, `aria-invalid` on the input.
- **Network error** — the failure message plus "the game still plays offline. Try refresh."; requests
  abort after 9 s. A leaderboard outage never blocks gameplay or restarting.
- **Duplicate submit** — the same score+name is not re-inserted; the button re-enables on failure.

## Data model and security

```sql
public.scores(id uuid pk, name text, score int, created_at timestamptz)
```

- RLS is **enabled and forced** on the only table in the exposed `public` schema.
- Table-level privileges are revoked from `anon`/`authenticated` and re-granted as `SELECT, INSERT`
  only. There is no `UPDATE` or `DELETE` policy, so those requests are rejected (verified: HTTP 401
  `permission denied`).
- Validation lives in the database, not only in JS: `CHECK` constraints enforce
  `1 <= char_length(btrim(name)) <= 16`, a `^[A-Za-z0-9 _.\-]{1,16}$` character allowlist, and
  `0 <= score <= 10000000`. The `INSERT` policy repeats the same predicates in `WITH CHECK`.
  `src/game.ts` mirrors these rules so the client fails fast, and tests assert the parity.
- The browser only ever receives the **publishable (anon) key**. No service-role/secret key exists in
  the repo, the build output, or the deployed bundle (asserted by the production smoke test).
- Score integrity: the client is authoritative for its own score, which is inherent to a client-side
  arcade game; the database caps implausible values and rejects malformed names.

Reproduce the remote schema on any project:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_leaderboard.sql
# or: supabase db push
```

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN=... npx wrangler@4 pages deploy dist \
  --project-name shootemup-bench-monolith-opus-5-medium-opencode --branch main
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are inlined at build time from `.env`
(both are public values). Cloudflare project names cannot contain underscores, so the treatment id
uses dashes in the project name.

## Verification performed

`node scripts/verify-production.mjs` against the live URL: 24/24 checks passed — HTTP 200, all nine
`data-testid` hooks present, live gameplay spawning enemies and projectiles, mute toggle, adapter
game-over, empty-name rejection, a real Supabase insert, persistence of that row after a full page
reload, descending order, restart, mobile touch controls visible at 390 px, and no uncaught errors.
`npm test` (15 tests) and `npm run typecheck` pass.
