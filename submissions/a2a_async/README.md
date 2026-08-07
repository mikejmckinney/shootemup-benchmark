# Neon Barrage

Neon Barrage is a dependency-light, responsive browser shoot-'em-up. The client is a static HTML/CSS/ES-module app; the only remote data dependency is Supabase's browser-safe REST Data API for the public leaderboard.

## Local setup

1. Install Node 20+ and run `npm install` (the lockfile pins the Wrangler toolchain).
2. Put a Supabase project URL and publishable/legacy anon key in `supabase-config.js`. Never use a service-role or secret key here.
3. Apply `supabase/migrations/20260805222000_create_leaderboard.sql` in the project's SQL editor or with the Supabase management API.
4. Run `npm test`, `npm run check`, and `npm run build`. Serve `dist/` with any static server, for example `npx serve dist`.

## Controls and architecture

Arrow keys or WASD move the ship; Space fires. On narrow screens, the on-screen directional pad and FIRE control use pointer events. Audio is synthesized through Web Audio only after a user gesture, and the header mute control is always visible. `src/game-logic.mjs` owns validation and deterministic gameplay helpers. `app.js` owns the canvas loop, collision feedback, escalating threat level, game-over flow, and the required test adapter. `supabase-client.js` uses only the public REST API with `SELECT` and `INSERT`.

The production adapter is:

```js
window.__NEON_BARRAGE__.getState()
window.__NEON_BARRAGE__.endGameForTest(1200)
```

The second call transitions through the same game-over/name/submit UI as normal play; it does not call Supabase directly.

## Supabase security decisions

The migration enables RLS on the exposed table, grants public roles only `SELECT` and column-scoped `INSERT(player_name, score)`, and creates no update/delete policies. Database `CHECK` constraints enforce a trimmed, printable 1–16 character pilot name and a non-negative integer score no larger than 1,000,000,000. The static bundle contains no service-role credential.

## Deployment

Build with `npm run build`, create a Cloudflare Pages project named with the benchmark treatment prefix, and deploy `dist/` with `npx wrangler pages deploy dist --project-name <project>`. Configure the custom domain/branch in Cloudflare as needed. Verify the production HTTP response and exercise the real leaderboard POST followed by a GET before handing off.
