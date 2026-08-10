# Neon Barrage

A neon-arcade browser shoot-'em-up: canvas rendering, generated Web Audio, and a
persistent global leaderboard backed by Supabase. Deployed on Cloudflare Pages.

- **Play:** https://shootemup-bench-monolith-opus-5-medium-claude-code-game.pages.dev
- **Leaderboard API:** `https://htqzxazubahirqgverex.supabase.co/rest/v1/leaderboard`

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys or `W` `A` `S` `D` | D-pad, or drag anywhere on the canvas |
| Fire | `Space` | `FIRE` button |
| Pause | `P` | — |
| Mute | `M` | Sound toggle in the header |
| Start / restart | `Enter` or the Start button | Start button or `FIRE` |

Kill enemies without letting one escape to build a combo; every 5 consecutive
kills raises the multiplier (up to x5). Waves escalate every 22 seconds: faster
spawns, tougher hulls, more aimed fire. From wave 5 the ship gains a spread shot.

## Local setup

```bash
npm ci          # exact, lockfile-pinned versions
npm test        # 28 unit tests (vitest) over simulation + leaderboard client
npm run lint    # eslint
npm run dev     # static server on http://localhost:4173
npm run build   # emits dist/
npm run deploy  # build + wrangler pages deploy
```

End-to-end smoke test against a running URL (Chromium via Playwright):

```bash
BASE_URL=https://shootemup-bench-monolith-opus-5-medium-claude-code-game.pages.dev \
  npx playwright test e2e/smoke.spec.js
```

## Architecture

No bundler and no runtime dependencies — the app ships native ES modules, so
`dist/` is a byte-for-byte copy of the source plus `_headers`.

| File | Responsibility |
|---|---|
| `src/game.js` | Pure simulation: state, input flags, spawning, collisions, scoring, waves. No DOM, seeded PRNG, fully unit-testable. |
| `src/render.js` | Canvas painter for a fixed 480x720 world. Backgrounds, ships, particles, CRT vignette/scanlines. |
| `src/audio.js` | Web Audio SFX synthesised on demand. The `AudioContext` is created lazily inside `unlock()`, which only runs from a user gesture. |
| `src/leaderboard.js` | PostgREST client plus name/score validation shared by the UI. |
| `src/main.js` | Wiring: canvas sizing (DPR-aware, letterboxed), keyboard/touch input, HUD, overlay states, submission form, leaderboard rendering, test adapter. |
| `src/config.js` | Public Supabase URL + anon key. |
| `supabase/migrations/` | SQL that reproduces the remote schema, constraints, grants and RLS policies. |

The render loop is a single `requestAnimationFrame` driving `game.update(dt)` and
`render()`. `dt` is clamped so a backgrounded tab cannot teleport enemies through
the player.

### Game states

`ready → playing → gameover → playing …`, plus a `paused` overlay. Every non-playing
state shows the same overlay panel with different copy; the score-submission form
appears only on game over.

### Test adapter

```js
window.__NEON_BARRAGE__.getState()          // { phase, score, lives, playerX, playerY, enemyCount, projectileCount }
window.__NEON_BARRAGE__.endGameForTest(500) // same path as losing your last life
```

`endGameForTest` starts a run if one is not in progress and then calls the exact
`endGame()` used by the death path, which fires the `gameover` event that renders
the overlay and submission form. It performs no network calls and cannot bypass
name/score validation — submission still goes through the normal form, the client
validator and the database constraints.

## Data model

```sql
public.leaderboard(id uuid pk, name text, score integer, created_at timestamptz)
```

- `name` must equal its trimmed form and match `^[A-Za-z0-9 ._-]{1,16}$`.
- `score` must be an integer in `[0, 10000000]`.
- Index on `(score desc, created_at asc)` serves the top-10 query.

## Security decisions

- **Only the anon (publishable) key reaches the browser.** The service-role key is
  never read, stored, or referenced in this repository. Management-API calls used
  during setup ran with an operator token from the environment and were never
  written to any shipped file.
- **RLS is enabled and forced** on `public.leaderboard`, the only table in the
  exposed `public` schema.
- **Least privilege:** `anon`/`authenticated` are granted `SELECT` and `INSERT`
  only. `UPDATE`/`DELETE` are revoked at both the grant and policy layer, so a
  visitor cannot rewrite or erase anyone's score (verified: both return 401).
- **Validation lives in the database, not just JS.** The insert policy repeats the
  name pattern and score bounds, and `CHECK` constraints enforce them even for a
  future privileged writer. A crafted `fetch` with the public key cannot insert
  `<script>alert(1)</script>` or a negative score — both are rejected by Postgres.
- **No HTML injection surface:** leaderboard rows are rendered with
  `textContent`, never `innerHTML`.
- **`_headers`** ships a strict CSP (`script-src 'self'`, `connect-src` limited to
  this Supabase project), `nosniff`, `frame-ancestors 'none'`, and a restrictive
  `Permissions-Policy`.

Scores are inherently client-reported, which is the accepted trade-off for a
serverless arcade leaderboard; the database caps the range so the board cannot be
poisoned with absurd values, and one run can only submit once from the UI.

## Resilience

- Leaderboard load failure shows an inline error plus a Refresh action; the game
  stays fully playable.
- Submission errors (network, constraint violation) leave the form editable and
  surface the server message.
- Empty board renders an explicit empty state rather than a blank list.
- Invalid names are caught client-side with an accessible `aria-invalid` message
  before any request is made, and again by Postgres if bypassed.

## Deployment

```bash
npm run build
CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist \
  --project-name shootemup-bench-monolith-opus-5-medium-claude-code-game --branch main
```

Database schema:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260810120000_leaderboard.sql
# or: POST the file to /v1/projects/<ref>/database/query on the Supabase Management API
```
