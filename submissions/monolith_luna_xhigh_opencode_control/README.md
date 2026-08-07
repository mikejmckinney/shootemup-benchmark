# Neon Barrage

Neon Barrage is a responsive, canvas-based arcade shooter set above a failing cyberpunk skyline. Pilot the lightship, clear hostile formations, and submit your best run to the public top-10 feed.

## Local setup

This is a dependency-free static site. Copy `config.example.js` to `config.js` and set the Supabase project URL and browser-safe publishable/anon key, then serve the directory with any static server:

```sh
cp config.example.js config.js
npx serve .
```

Run the checks with `npm test` and `npm run check`.

## Controls

Use `WASD` or the arrow keys to move, and hold `Space` to fire. On narrow screens, use the on-screen directional pad and `FIRE` button. Sound is opt-in after the first interaction and can be muted from the top-right control.

## Architecture

`game.js` owns a fixed 960x600 simulation rendered into a responsive canvas. The loop updates movement, waves, enemy fire, collision damage, particles, and difficulty, while the DOM owns the overlays, HUD, form validation, and leaderboard states. `window.__NEON_BARRAGE__` is a narrow production test adapter that uses the same game-over path as regular play. `supabase/migrations/001_leaderboard.sql` is the reproducible database schema and policy source.

## Deployment

1. Create a Supabase project and apply `supabase/migrations/001_leaderboard.sql` using the SQL editor or database API.
2. Put the project URL and its public anon/publishable key in `config.js`. Never put a service-role or secret key in this file.
3. Deploy the directory as static assets to Cloudflare Pages with Wrangler:

```sh
npx wrangler pages project create <project-name>
npx wrangler pages deploy . --project-name <project-name>
```

The deployed site only uses `GET` and `POST` against the Supabase REST endpoint. RLS enables public reads and valid score inserts, with no public update or delete policy. Database check constraints repeat name and score validation so client-side validation is not the security boundary.
