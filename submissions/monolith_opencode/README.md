# Neon Barrage

Neon Barrage is a responsive canvas shoot-'em-up built around a compact arcade loop: steer an interceptor, hold fire, survive increasingly fast waves, and submit the final score to a public top-ten leaderboard.

## Local Setup

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

The production build is generated with `npm run build` and can be served locally with `npm run preview`. The checked-in `package-lock.json` pins the Vite toolchain.

## Controls

- Move with `WASD` or the arrow keys.
- Hold `Space` to fire.
- On a narrow viewport, use the on-screen left, fire, and right controls.
- Sound is opt-in after launch and can be muted from the top-right control.

## Architecture

- `src/main.js` owns the animation loop, input, collision handling, canvas renderer, Web Audio effects, UI state, and leaderboard REST calls.
- `src/game-logic.js` contains pure validation, collision, state, and difficulty helpers covered by Node tests.
- `src/style.css` provides the responsive cyberpunk visual system, HUD, game-over form, and touch layout.
- `supabase/migrations/001_create_leaderboard.sql` reproduces the database table, constraints, grants, and RLS policies.
- `window.__NEON_BARRAGE__` exposes only `getState()` and `endGameForTest(score)` for deterministic browser tests. The adapter follows the same game-over and score form path as normal play.

## Database And Security

The browser uses only the Supabase URL and public anonymous key in `src/config.js`. No service-role or secret key is bundled. The single exposed table has RLS enabled, allows public `select` and append-only `insert`, and has no public update or delete policy. Name length, allowed characters, and the signed 32-bit score range are enforced by database `CHECK` constraints as well as client validation.

To reproduce the schema in another project, run the migration SQL with the Supabase SQL editor or the management API. The REST endpoint is queried with an explicit score/order/limit and renders values through `textContent`.

## Verification And Deployment

Run the local checks:

```sh
npm test
npm run build
```

Create or select a Cloudflare Pages project, then deploy the generated static directory with Wrangler:

```sh
export CLOUDFLARE_API_TOKEN="..."
npx wrangler@4.28.1 pages project create shootemup-bench-monolith-opencode-neon-barrage --production-branch main
npx wrangler@4.28.1 pages deploy dist --project-name shootemup-bench-monolith-opencode-neon-barrage
```

The production site is static; Supabase handles persistence directly from the browser using RLS. After deployment, verify the production HTTP response, open the page in a browser, use the test adapter to reach game over, submit a valid callsign, and reload to confirm the leaderboard read path.
