# Neon Barrage

Neon Barrage is a static, canvas-based browser shoot-'em-up. It is deliberately dependency-light: the game runs in the browser, while Supabase PostgREST provides the small public leaderboard API.

## Local setup

1. Copy the deployed project values into `supabase-config.js`:

```js
window.__NEON_BARRAGE_CONFIG__ = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_PUBLIC_ANON_KEY"
};
```

2. Serve the directory over HTTP. ES modules and Supabase requests are not intended to run from `file://` URLs:

```sh
npx serve .
```

3. Open the printed local URL. The leaderboard will show an offline/configuration message until the config values and migration have been applied.

## Controls

- Move with `WASD` or the Arrow keys.
- Hold `Space` to fire.
- On a narrow viewport, use the four-way touch pad and `FIRE` button.
- The sound toggle is in the upper-right corner. AudioContext is created only in a user interaction handler.
- A run ends when the three hull points are gone. Enter a 1-16 character pilot tag and post the score.

## Architecture

- `engine.js` contains the state machine, movement, spawning, projectiles, collision detection, scoring, lives, and wave escalation. It has no DOM dependencies and is covered by `node:test`.
- `app.js` owns the animation loop, neon canvas renderer, keyboard/pointer input, generated Web Audio feedback, UI states, and the Supabase REST calls.
- `supabase/migrations/20260806000000_create_leaderboard.sql` is the reproducible database schema and RLS policy definition.
- `supabase-config.js` contains only the Supabase URL and public anon key. No service-role or database credential is sent to the browser.

The production test adapter is `window.__NEON_BARRAGE__`. `getState()` returns the narrow game state needed for black-box tests. `endGameForTest(score)` goes through the same game-over panel as a normal run and never submits directly.

## Database and security

The only exposed table is `public.leaderboard_entries`. RLS is enabled. The anonymous role can only select rows and insert rows satisfying database check constraints: ASCII pilot tags are 1-16 characters and scores are signed, non-negative, plausible integers. Anonymous update and delete are not granted. The browser uses only the public anon key, whose permissions are constrained by these policies.

## Verification and deployment

Run the local checks:

```sh
npm test
npm run build
npm run lint
```

Deploy the static assets to a Cloudflare Worker with a treatment-prefixed name (the worker uses the allowed Workers static-assets mode):

```sh
npx wrangler deploy
```

`wrangler.toml` points at the private `public/` deployment bundle so source files, migrations, tests, and repository metadata are not published.

Before the handoff, verify the production URL returns HTTP 200 and use the public key to perform both a PostgREST insert and an ordered read. `benchmark-result.json` records those live verification results and contains no secret credential.
