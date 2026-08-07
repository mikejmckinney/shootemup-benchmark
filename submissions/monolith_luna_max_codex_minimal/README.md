# Neon Barrage

Neon Barrage is a dependency-light browser shoot-'em-up built around a fixed-coordinate HTML canvas and a responsive shell. The game is playable with Arrow keys or WASD plus Space, and exposes a compact touch pad on narrow viewports.

## Local setup

No runtime package install is required. Use Node 20+:

```bash
npm test
npm run lint
npm run build
npx serve dist
```

Copy `public/config.js` to a local override or replace its two placeholders with a Supabase URL and anon key for leaderboard testing. These are the only Supabase values that belong in the browser. The anon key is protected by RLS; the service-role key is never shipped.

## Controls and architecture

`public/app.js` owns the real-time loop, keyboard/touch input, procedural canvas art, collisions, escalating enemy waves, particles, Web Audio feedback, game-over flow, and leaderboard fetch/insert states. `public/game-logic.js` contains the small, browser-safe validation/collision module covered by `test/game.test.js`. `public/style.css` provides the responsive neon control-room layout.

The production test adapter is `window.__NEON_BARRAGE__`. Its `getState()` reports the live game state and `endGameForTest(score)` enters the same game-over form used by ordinary play; it never calls Supabase directly.

## Database and security

`supabase/migrations/202608060001_neon_barrage.sql` creates the only exposed table, enables RLS, grants anonymous clients only `SELECT` and `(name, score)` `INSERT`, and has no public update/delete policy. Database check constraints and the insert policy independently enforce trimmed 1–16 character tags and integer scores in the signed 32-bit non-negative range. The UI repeats those checks for fast feedback, but the database is authoritative.

## Deployment

Build the static `dist/` directory and deploy it as a Cloudflare Pages project with Wrangler:

```bash
npm run build
npx wrangler pages deploy dist --project-name <cloudflare-project>
```

Apply the migration with the Supabase SQL editor or management tooling, then set the public URL and anon key in `public/config.js` before building. Verify both the production HTTP response and an anon REST insert/read round trip before handing off.
