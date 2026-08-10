# Neon Barrage

A polished browser shoot-'em-up built with vanilla TypeScript + the HTML5 Canvas 2D API, no game framework. Persistent global leaderboard backed by Supabase Postgres.

## Play

Production URL: see `benchmark-result.json` (`cloudflare_url`).

Controls: Arrow keys / WASD to move, Space to fire. On touch devices, a virtual stick (bottom-left) and fire button (bottom-right) appear automatically.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in your own Supabase project URL + publishable key
npm run dev
```

Other scripts:

```bash
npm run build       # tsc -b && vite build -> dist/
npm run preview     # serve the production build locally
npm run typecheck   # tsc --noEmit
npm test            # vitest run (unit tests for validation + core game logic)
```

## Architecture

- `src/game.ts` — the `Game` class: fixed-timestep-ish update loop (`requestAnimationFrame`), entity state (player/enemies/projectiles/particles), collision detection (AABB), scoring, lives, escalating difficulty (spawn rate and enemy speed scale with elapsed time), and canvas rendering. No external game engine.
- `src/input.ts` — keyboard (Arrow/WASD/Space) and touch (virtual joystick + fire button) input, unified behind one `InputManager`.
- `src/audio.ts` — Web Audio synth (oscillators + a noise burst for explosions). No audio files. `AudioContext` is constructed and resumed only from inside the Start/Restart click handlers, satisfying browser autoplay policies.
- `src/leaderboard.ts` — client-side name/score validation (mirrors the DB constraints) plus `fetchTopScores`/`submitScore` against Supabase, and leaderboard DOM rendering with loading/empty/error states.
- `src/supabaseClient.ts` — creates the Supabase JS client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (the public **publishable** key only).
- `src/main.ts` — DOM wiring, overlays (start/game-over), and the `window.__NEON_BARRAGE__` black-box test adapter.

### Test adapter

`window.__NEON_BARRAGE__` is defined in production:

```js
window.__NEON_BARRAGE__.getState()        // { phase, score, lives, playerX, playerY, enemyCount, projectileCount }
window.__NEON_BARRAGE__.endGameForTest(score)
```

`endGameForTest` calls the same `Game.triggerGameOver` path a real death does — it does not touch Supabase or bypass validation. It only forces `phase -> "gameover"` with the given score so black-box tests don't have to survive a full playthrough to exercise the score-submission UI.

## Data & security model

Table `public.leaderboard` (see `supabase/migrations/20260810000000_leaderboard.sql`):

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | server-generated |
| `player_name` | text | `CHECK` 1-16 chars, `^[A-Za-z0-9 _-]{1,16}$` |
| `score` | integer | `CHECK` `0 <= score <= 1_000_000_000` |
| `created_at` | timestamptz | server-generated, used as a tiebreaker |

- **RLS is enabled** on the table. Two policies only:
  - `leaderboard_public_select` — `anon`/`authenticated` may `SELECT` all rows (needed to render the board).
  - `leaderboard_public_insert` — `anon`/`authenticated` may `INSERT`, gated by the same name/score constraints as the DB `CHECK`s (defense in depth — belt and suspenders).
  - No `UPDATE`/`DELETE` policy exists, so the table is append-only from the browser.
  - Column grants further restrict inserts to `player_name, score` only (`id`/`created_at` can't be client-supplied).
- **No service-role key ever ships to the client.** Only the Supabase **publishable/anon** key is bundled (`VITE_SUPABASE_ANON_KEY`, embedded at build time via Vite's `import.meta.env`). The secret key lives only in the Supabase dashboard/management API and was used solely to apply the migration.
- Validation happens twice: in `src/leaderboard.ts` before any network call (fast UX feedback), and again in Postgres via `CHECK` constraints + RLS `WITH CHECK` (authoritative — the client can be bypassed, the database can't).
- The leaderboard UI degrades gracefully: shows a loading message on first fetch, an explicit empty state ("No scores yet"), and a visible error message (not a crash) if the network call or the Supabase query fails, both on the start screen and the game-over screen.

## Deployment

- **Frontend**: static Vite build deployed to Cloudflare Pages via Wrangler (`wrangler pages deploy dist`). Environment variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are baked into the bundle at build time (`.env.production`, safe to commit — publishable key only).
- **Backend**: a dedicated Supabase project (`shootemup-bench-monolith_sonnet_5_medium_claude_code-neon-barrage`), schema applied via the Supabase Management API using the migration SQL in `supabase/migrations/`.

## Known trade-offs

- Difficulty scaling and enemy patterns are intentionally simple (linear ramp) to keep the implementation auditable within the time budget; no boss fights or power-ups.
- No authentication — the leaderboard is fully public/anonymous by design, matching the product requirement of a lightweight arcade leaderboard.
