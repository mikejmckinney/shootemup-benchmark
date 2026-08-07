# Neon Barrage

> Gallery integration: the deployed game now uses the benchmark's shared Supabase project and reads/writes only the `a2a` leaderboard partition. The original migration below remains the candidate's historical benchmark artifact; the shared integration migration is [`../../supabase/migrations/20260805211711_shared_leaderboard.sql`](../../supabase/migrations/20260805211711_shared_leaderboard.sql).

Neon Barrage is a responsive, canvas-based arcade shoot-'em-up. Pilot the interceptor through an escalating drone storm, preserve three hull points, and submit a validated callsign to the public top-ten board.

## Local setup

This project intentionally has no runtime framework or unpinned CDN dependency. It requires Node 20+.

```bash
npm install
npm test
npm run check
npm run build
npx --yes serve dist
```

With no environment variables, the game runs fully offline and uses a local preview board. To use a Supabase project locally or in a deployment build, set `SUPABASE_URL` and the browser-safe `SUPABASE_ANON_KEY` before `npm run build`. Never use a service-role or database password in either variable.

## Controls

- Move with Arrow keys or WASD; hold Space to fire.
- On narrow screens, use the on-screen directional and FIRE controls.
- Press Escape to pause/resume. The mute control is always visible; Web Audio is created only after a user gesture.
- After game over, enter a 1–16 character callsign using letters, numbers, spaces, dots, dashes, or underscores and choose SEND.

## Architecture

- `site/index.html` and `site/src/style.css` define the responsive HUD, canvas shell, touch controls, loading/empty/error states, and visual language.
- `site/src/game.js` and `site/src/game-logic.js` own the animation loop, input, collision model, difficulty scaling, feedback particles, and canvas rendering.
- `site/src/leaderboard.js`, `site/src/audio.js`, and `site/src/main.js` own REST access, interaction-gated Web Audio, UI state, and score submission.
- `site/src/adapter.js` exposes the narrow production test adapter; its game-over method delegates to the real game transition.
- `scripts/build.mjs` creates a static `dist/` folder from the worker-owned `site/src` tree and injects only the Supabase URL and publishable/anon key into `dist/config.js`.
- `supabase/migrations/20260805165000_neon_barrage_leaderboard.sql` is the reproducible database schema and policy source of truth.

The production test surface is exposed as `window.__NEON_BARRAGE__`. `getState()` returns the current phase, score, lives, ship position, enemy count, and projectile count. `endGameForTest(score)` enters the same game-over UI as normal play; it does not submit or write data.

## Database and security

The migration enables RLS on `public.leaderboard`, permits anonymous SELECT and INSERT of only `player_name` and `score`, and has no public UPDATE or DELETE policy. Database constraints enforce trimming, the 1–16 character allowlist, and a non-negative signed 32-bit score even if a client is modified. The frontend sends the browser-safe anon/publishable key in standard PostgREST headers; the management token, service-role key, and database password never enter the static artifact.

## Cloudflare Pages deployment

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_ANON_KEY="<publishable-or-anon-key>" \
npm run build

CLOUDFLARE_ACCOUNT_ID="<account-id>" \
CLOUDFLARE_API_TOKEN="<pages-edit-token>" \
npx wrangler pages project create shootemup-bench-a2a-neon

CLOUDFLARE_ACCOUNT_ID="<account-id>" \
CLOUDFLARE_API_TOKEN="<pages-edit-token>" \
npx wrangler pages deploy dist --project-name shootemup-bench-a2a-neon --branch main
```

Before deployment, apply the migration to the newly created Supabase project, then verify an anonymous REST insert and ordered read. The final benchmark handoff is recorded in `benchmark-result.json`.
