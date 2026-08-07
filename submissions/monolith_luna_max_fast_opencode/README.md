# Neon Barrage

Neon Barrage is a small, dependency-light browser shoot-'em-up. Pilot the interceptor, clear the descending swarm, and submit a run to the public top-ten channel.

## Local Setup

Requirements: Node.js 20 or newer. The game itself has no runtime npm dependencies.

```sh
npm test
npm run check
npm run build
npx --yes serve dist
```

Open the local URL printed by `serve`. Without a configured Supabase URL and publishable key in `config.js`, the game remains fully playable and the leaderboard shows an explicit local-mode state.

## Controls

- Move with `WASD` or the arrow keys.
- Hold `Space` to fire.
- On a narrow viewport, hold the left, FIRE, and right touch controls.
- Sound is generated with Web Audio after the first user interaction. The visible Sound on/off control persists its preference locally.

## Architecture

- `index.html` contains the semantic shell, stable benchmark selectors, game overlays, and leaderboard form.
- `game.js` owns the Canvas render loop, input, particles, collision updates, game-over flow, generated audio, and Supabase REST calls.
- `game-logic.js` contains pure validation, collision, difficulty, and ranking functions used by both the game and Node tests.
- `styles.css` provides the responsive neon terminal visual system and mobile controls.
- `supabase/migrations/202608070001_neon_barrage.sql` reproduces the leaderboard table, checks, grants, and RLS policies.

The production test adapter is `window.__NEON_BARRAGE__`. Its `endGameForTest` method enters the same game-over view as a normal run; it validates that the supplied score is a non-negative integer and never writes to the database.

## Supabase Deployment

Create a new Supabase project, then apply the migration in the SQL editor or with the Supabase CLI. The browser only receives the project URL and publishable `anon` key in `config.js`; the management token and database password never enter the static site. RLS is enabled on the exposed table. Anonymous clients can only select rows and insert rows that satisfy the database name and score constraints. Update and delete are not granted.

After setting `config.js`, build again. The leaderboard reads the top ten in descending score order and posts only `{ name, score }`.

## Cloudflare Pages Deployment

Authenticate Wrangler with a Cloudflare API token that can manage Pages, then deploy the generated static directory:

```sh
npm run build
npx wrangler pages project create <project-name> --production-branch main
npx wrangler pages deploy dist --project-name <project-name>
```

The deployed artifact is static and needs no server-side secrets. Verify the production response, start a run, use the production test adapter to produce a game-over screen, submit a valid pilot tag, reload, and confirm the score remains in the top-ten channel.

## Verification

The local checks are:

```sh
npm test
npm run check
npm run build
```

The pure tests cover input and score contracts, collision boundaries, escalating spawn pressure, and leaderboard ranking/capping. Production verification also checks HTTP 200 and a real Supabase insert/read round trip.
