# Neon Barrage

Neon Barrage is a responsive, real-time canvas shoot-'em-up backed by a persistent Supabase leaderboard.

## Local setup

Requires Node.js 24 or newer.

```sh
npm install
npm run check
npx wrangler pages dev dist
```

`npm run check` performs JavaScript syntax checks, runs the gameplay/data unit tests, and creates the static `dist/` bundle.

## Controls

- Move with Arrow keys or WASD.
- Fire with Space.
- On narrow screens, use the directional pad and FIRE button.
- AUDIO toggles generated Web Audio. Audio is initialized only after a user gesture.

## Architecture

- `app.js` owns the animation loop, canvas renderer, input, collision flow, audio, UI state, test adapter, and Supabase REST calls.
- `game-core.js` contains deterministic collision, difficulty, and validation rules shared with tests.
- `styles.css` provides the responsive cabinet, mobile controls, visual effects, and leaderboard layout.
- `supabase/migrations/001_leaderboard.sql` reproduces the table, constraints, index, grants, and RLS policies.
- `test/game-core.test.js` tests collision semantics, difficulty escalation, and leaderboard value bounds using Node's test runner.

The static client uses only the Supabase publishable key. The `leaderboard` table has RLS enabled, grants anonymous users only selected-column reads and score/name inserts, and has no update/delete policy. Database checks trim and constrain callsigns to 1-16 safe characters and bound scores to plausible non-negative integers. No service-role or management credential is present in the bundle.

Network failures produce an inline status while leaving gameplay available. Loading, empty, invalid submission, success, and retry states are represented explicitly.

## Deployment

The schema was applied through the Supabase Management API to project `etugimyzwawgrrrzkcui`. To apply it to another project, run the SQL migration in its SQL editor or through the Management API.

Build and deploy the site:

```sh
npm run build
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY" npx wrangler pages deploy dist --project-name shootemup-bench-monolith-sol-medium-fast-opencode-neon --branch main
```

Production: <https://shootemup-bench-monolith-sol-medium-fast-opencode-neon.pages.dev/>

Cloudflare Pages does not permit underscores in project names, so the treatment portion is dash-normalized. The Supabase project name uses the exact required underscore prefix.
