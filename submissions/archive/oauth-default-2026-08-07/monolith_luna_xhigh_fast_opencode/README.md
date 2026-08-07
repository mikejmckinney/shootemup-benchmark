# Neon Barrage

Neon Barrage is a responsive, browser-based arcade shooter. Pilot the pulse-runner through an escalating swarm, then submit your score to the persistent public leaderboard.

## Local Setup

The app is dependency-free at runtime. Serve the repository root over HTTP because the game uses ES modules:

```sh
npm test
npm run check
npx serve .
```

Set the values in `src/config.js` to the Supabase project URL and its public `anon` key before deploying. The placeholders intentionally make an unconfigured local build show a usable game with a clear leaderboard status.

## Controls

- Desktop: Arrow keys or WASD to move, Space to fire.
- Mobile: use the directional pad and FIRE button, or drag on the game canvas to pilot and tap to fire.
- Sound is generated with Web Audio and starts only after a user gesture. Use the speaker control in the header to mute it.

## Architecture

- `index.html` contains the accessible shell and stable benchmark selectors.
- `src/app.js` owns the canvas render loop, input, collisions, effects, audio, game-over adapter, and REST leaderboard calls.
- `src/game-state.js` contains pure gameplay/data-validation helpers covered by Node's built-in test runner.
- `supabase/migrations/001_leaderboard.sql` reproduces the table, constraints, index, grants, and RLS policies.

## Deployment

The site is a static Cloudflare Pages project. Deploy the repository root with Wrangler:

```sh
npx wrangler pages project create shootemup-bench-<treatment>
npx wrangler pages deploy . --project-name shootemup-bench-<treatment>
```

Create a Supabase project in the required organization, run the migration, and put only the project URL and public `anon` key into `src/config.js`. No service-role credential is used by the browser. RLS allows only public `select` and constrained `insert`; update/delete are not granted.

## Verification

Check the production URL returns HTTP 200, use the production app's `window.__NEON_BARRAGE__.endGameForTest(nonNegativeInteger)` adapter to reach the normal score form, submit a valid callsign, and reload to confirm the row persists. `npm test` and `npm run check` are the local automated checks.
