# Neon Barrage

Neon Barrage is a responsive, canvas-based arcade shooter. Fly the interceptor, clear incoming drones, and submit your final score to the persistent top-pilot board.

## Local setup

This is a dependency-free static site. Serve the directory with any static server, for example `npx serve .`, then open the printed URL. Set `supabaseUrl` and `supabaseAnonKey` in `config.js` to enable the leaderboard locally. The public anon key is the only browser credential used.

## Controls

- `WASD` or arrow keys move the ship.
- `Space` fires.
- On narrow screens, use the on-screen movement and fire buttons.
- The sound control is muted by default only until the first user gesture; Web Audio starts after interaction.

## Architecture

`app.js` owns the requestAnimationFrame loop, input, entity simulation, collision detection, particles, scoring, and the production test adapter. `index.html` provides the semantic game and score UI, while `styles.css` provides the dark orbital/neon visual system and responsive layout. The leaderboard uses direct Supabase REST calls with the public anon key. `supabase/migrations/001_scores.sql` defines server-side score/name checks and least-privilege RLS policies.

## Deployment

Create a Supabase project, run the migration in its SQL editor or with the Supabase CLI, and place its URL and anon key in `config.js`. Create a Cloudflare Pages project and deploy this directory with Wrangler:

```sh
npx wrangler pages project create neon-barrage
npx wrangler pages deploy . --project-name neon-barrage
```

The production deployment must be served over HTTPS. No service-role or management credential belongs in `config.js` or the browser bundle.

## Verification

The stable black-box selectors are present in the markup. In production, `window.__NEON_BARRAGE__.getState()` reports game state and `endGameForTest(nonNegativeInteger)` enters the same score submission UI as normal gameplay.
