# Neon Barrage

A neon-arcade, browser shoot-'em-up with a persistent global leaderboard.

- **Live:** https://shootemup-bench-monolith-opus-5-medium.pages.dev
- **Frontend:** Cloudflare Pages (static assets, Vite build)
- **Leaderboard:** Supabase Postgres via PostgREST, anonymous publishable key + RLS

---

## Quick start

```bash
npm ci                 # install pinned deps (package-lock.json committed)
npm run dev            # vite dev server
npm run typecheck      # tsc --noEmit
npm test               # vitest unit tests (engine + leaderboard client)
npm run build          # production build into dist/
npm run e2e            # Playwright smoke tests (builds + previews locally)
BASE_URL=https://shootemup-bench-monolith-opus-5-medium.pages.dev npm run e2e   # against production
npm run check          # typecheck + unit tests + build
```

Environment (public values only, committed in `.env.production` / `.env.development`):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

See `.env.example`. No secret or service-role key exists anywhere in the client bundle or repo.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys or `W` `A` `S` `D` | D-pad in `[data-testid="touch-controls"]`, or drag on the canvas |
| Fire | `Space` | `FIRE` button, or hold/drag on the canvas |
| Pause | `P` or `Esc` | — (auto-pauses when the tab is hidden) |
| Mute | `M` or the sound button | Sound button |

Gameplay: 3 lives, brief invulnerability after a hit, three enemy archetypes
(grunt / weaver / tank), enemy fire that leads the player, waves every 22 seconds,
and a difficulty multiplier that scales spawn rate, enemy speed and fire rate with
elapsed time. From wave 3 the player gains a three-way spread shot.

## Architecture

```
index.html          markup, HUD, overlays, leaderboard panel, touch pad
src/engine.ts       headless simulation: entities, spawning, collisions, scoring,
                    phases, validation helpers. No DOM — unit tested in Node.
src/render.ts       canvas renderer (DPR-aware, letterboxed 480x720 world)
src/audio.ts        Web Audio synth; context created only on a user gesture
src/leaderboard.ts  typed PostgREST client: top(), submit(), timeouts, error kinds
src/main.ts         wiring: input, HUD sync, overlays, submit flow, test adapter
src/styles.css      art direction, responsive layout, reduced-motion support
supabase/migrations/0001_leaderboard.sql   remote schema + RLS reproduction
tests/*.test.ts     vitest unit tests
tests/e2e/          Playwright black-box tests (local or production)
```

The renderer draws a scaled 480x720 logical world so gameplay is identical on any
viewport; the layout collapses the leaderboard under the stage below 900px and
reveals the touch pad on coarse pointers or narrow screens.

### Test adapter

```js
window.__NEON_BARRAGE__.getState();          // { phase, score, lives, playerX, playerY, enemyCount, projectileCount }
window.__NEON_BARRAGE__.endGameForTest(4321) // same game-over + submit UI as real play
```

`endGameForTest` floors/clamps its argument to a non-negative integer, starts a run
if the game is on the menu, then calls the same `Game.endGame()` path that a real
death takes. It never talks to Supabase and never bypasses the name/score checks —
the score still has to go through the normal form, the client validator, and the
database `CHECK` constraints and RLS `WITH CHECK` policy.

## Data model and security

`public.leaderboard(id uuid pk, name text, score int, created_at timestamptz)`

Defence in depth, enforced in the database (not just JavaScript):

- `CHECK` constraints: trimmed name length 1-16, charset `[A-Za-z0-9 _\-.]`,
  score is an integer in `[0, 10_000_000]`.
- A `BEFORE INSERT` trigger trims the name and overwrites `id`/`created_at` server-side,
  so a client cannot spoof identity or timestamps.
- RLS is **enabled and forced** on the only table in the exposed `public` schema.
- Policies: `SELECT` for `anon`/`authenticated` (`using (true)`), `INSERT` with a
  `WITH CHECK` that repeats the validation rules. There is **no** `UPDATE` or
  `DELETE` policy, and those grants are revoked, so anonymous clients can only
  append and read.
- The browser only ever receives the **publishable** key (`sb_publishable_…`).
  The service-role/secret key is never referenced in source, `.env*`, or the bundle.
- Client-side `validateName`/`validateScore` mirror the DB rules for fast feedback;
  the DB is the authority.

## Resilience / UX states

- Leaderboard: loading, empty ("be the first pilot"), network error and server error
  states all render inside `[data-testid="leaderboard"]` with a manual retry (⟳).
  A leaderboard outage never blocks gameplay.
- Submission: inline validation errors, in-flight "Submitting…" disabled state,
  success confirmation with the saved row highlighted, and a "Retry Submit" affordance
  on failure. Requests time out after 9s via `AbortController`.
- Audio is muted-persistent via `localStorage` and only starts after a user gesture.
- `prefers-reduced-motion` disables animations.

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_KEY \
  npx wrangler pages deploy dist \
  --project-name shootemup-bench-monolith-opus-5-medium --branch main
```

Database schema is applied from `supabase/migrations/0001_leaderboard.sql`
(via the Supabase Management API query endpoint, or `supabase db push`).

## Verification performed

- `npm run typecheck`, `npm test` (27 unit tests), `npm run build` — all green.
- Playwright suite run **against the production URL**: boots, keyboard movement,
  firing, enemy spawning, adapter-driven game over, validation error, real Supabase
  insert, leaderboard refresh, persistence across reload, mute toggle, and touch
  controls on a 390x780 mobile context.
- `GET https://shootemup-bench-monolith-opus-5-medium.pages.dev/` → 200.
