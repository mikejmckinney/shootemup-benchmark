# Neon Barrage

Neon Barrage is a responsive browser shoot-'em-up built around a fixed-resolution HTML canvas and a small Supabase REST client. The game is intentionally dependency-free at runtime so the deployed Pages artifact is fast, auditable, and easy to reproduce.

## Local Setup

Requirements: Node.js 20 or newer.

```sh
npm install
SUPABASE_URL=https://your-project.supabase.co SUPABASE_ANON_KEY=your-public-key npm run verify
SUPABASE_URL=https://your-project.supabase.co SUPABASE_ANON_KEY=your-public-key npm run build
npx --yes serve dist
```

Open the local URL printed by `serve`. A build without Supabase variables remains playable and displays a clear offline leaderboard state.

## Controls

- Move with `WASD` or the Arrow keys.
- Fire with `Space`.
- On narrow screens, use the on-screen directional pad and `FIRE` button.
- Use the sound control in the top-right to mute or restore generated Web Audio effects.
- Start or restart from the overlay button, or press `Enter`.

## Architecture

- `src/index.html` contains the accessible game shell and stable benchmark selectors.
- `src/game.js` owns the animation loop, input, collision system, difficulty ramp, rendering, audio, game-over flow, and leaderboard requests.
- `src/game-logic.js` contains DOM-free collision, validation, difficulty, and score helpers used by local tests.
- `scripts/build.mjs` copies the static app and generates `dist/config.js` from `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- `supabase/migrations/20260807000000_create_leaderboard.sql` creates the only exposed table, constraints, index, grants, and RLS policies.

The production test adapter is `window.__NEON_BARRAGE__`. It reports the live game state and routes `endGameForTest(score)` through the same game-over, validation, and submission UI as normal play.

## Supabase

Create a new Supabase project, then apply the migration through the SQL editor or the Supabase management API. The browser only receives the project URL and publishable/anon key. The service-role key is never embedded or requested by the frontend.

The `anon` role has only `SELECT` and `INSERT` on `public.leaderboard`. Row-level security is enabled on the table; database `CHECK` constraints and the insert policy independently enforce a trimmed 1-16 character name, reject control characters, and limit scores to non-negative plausible integers. There are no public update or delete policies.

## Cloudflare Pages

Build with the production Supabase variables, create a Pages project, and deploy the generated `dist` directory:

```sh
SUPABASE_URL=https://your-project.supabase.co SUPABASE_ANON_KEY=your-public-key npm run build
npx --yes wrangler pages project create your-pages-project --production-branch main
CLOUDFLARE_API_TOKEN=your-token npx --yes wrangler pages deploy dist --project-name your-pages-project --branch main
```

The deployed artifact is static; Cloudflare does not need a server-side secret or function for this game.

## Verification

`npm test` runs gameplay/data helper tests. `npm run check` performs JavaScript syntax checks, and `npm run verify` runs both plus a clean production-style build. Deployment verification should check the Pages HTTP response and perform a real Supabase insert followed by an ordered read using the public key.
