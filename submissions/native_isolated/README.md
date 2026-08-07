# Neon Barrage

> Gallery integration: the deployed game now uses the benchmark's shared Supabase project and reads/writes only the `native_isolated` leaderboard partition. The original migration below remains the candidate's historical benchmark artifact; the shared integration migration is [`../../supabase/migrations/20260805211711_shared_leaderboard.sql`](../../supabase/migrations/20260805211711_shared_leaderboard.sql).

Neon Barrage is a responsive, canvas-based neon shoot-'em-up with a persistent
Supabase leaderboard. The game is a static browser application: the canvas and
game loop run locally in the browser, while the browser talks directly to the
Supabase Data API for leaderboard reads and score submissions.

Values written as `<placeholder>` below are examples, not live values. Replace
them only in local or deployment environment configuration. Do not commit
tokens, service-role keys, or other secrets to this repository.

## Prerequisites and local setup

- Node.js 22 or newer is required by `package.json`; use the npm version bundled
  with that Node release.
- npm is the canonical package manager. The Wrangler dev dependency is pinned
  to `4.47.0`. Use the committed `package-lock.json` and install with `npm ci`;
  do not mix package managers or update dependencies without regenerating and
  committing the lockfile.
- A Supabase project is needed for leaderboard persistence. The game can still
  load without a reachable project, but score reads/submissions will show their
  loading or network-error states.

The static page reads browser configuration from
`window.NEON_BARRAGE_CONFIG` in `public/config.js`. The benchmark artifact
contains the target project's URL and publishable key there; both are public by
design. For another local project, replace those two public values before
serving the page, but never put a service-role key or management credential in
the file.

From the repository root:

```sh
npm ci                         # reproducible install when package-lock.json exists
npm run dev
```

If a fresh integration checkout does not yet contain `package-lock.json`, run
`npm install` once to bootstrap and commit the generated lockfile; subsequent
installs should use `npm ci`. If an `.env.example` is provided, use it as a
template for the local config, but keep management credentials out of it.

`npm run dev` serves the static source tree locally. Restart it after changing
the runtime config.

## Environment variables

| Variable | Scope | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Browser config/build; public | `https://<project-ref>.supabase.co` for the target project; emitted as `supabaseUrl`. |
| `SUPABASE_PUBLISHABLE_KEY` | Browser config/build; public | `<sb_publishable_...>` (the project’s designated public/anon key); emitted as `supabaseAnonKey`. This is intentionally visible to users. |
| `CLOUDFLARE_API_TOKEN` | Wrangler/CI; secret | Token used only to create or direct-upload a Pages deployment. |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler/CI; non-secret identifier | Cloudflare account containing the Pages project, when Wrangler needs non-interactive account selection. |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI/CI; secret | Management token used only to link the project and apply migrations. |

The last three variables are deployment or database-management variables, not
frontend configuration. If an automation environment supplies the benchmark
aliases `CLOUDFLARE_API_KEY` or `SUPABASE_API_KEY`, map them in the process
environment to the CLI name it expects; do not write either value to a file or
emit it in `public/config.js`:

```sh
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY"
export SUPABASE_ACCESS_TOKEN="$SUPABASE_API_KEY"
```

## Controls and gameplay

- Start the game with the Start control. After game over, use the same control
  to restart.
- On a keyboard, move with Arrow keys or `WASD`; hold `Space` to fire.
- On a narrow/mobile viewport, hold the directional touch controls to move and
  hold the FIRE control to shoot. The touch-control container remains available
  without requiring a keyboard.
- Use the visible mute control to toggle generated sound. Audio starts only
  after a user gesture, as required by browser autoplay policies.

Destroy incoming enemies with projectiles to earn points. Enemy pressure and
spawn difficulty increase as the run continues. Collisions consume lives; when
all lives are gone the game enters game over, shows the final score, and allows
the player to submit a 1–16 character name. The leaderboard displays at least
the top ten scores in descending order and survives a page reload through
Supabase. Empty, loading, validation, and network-error states do not prevent
the game itself from being played.

## Deterministic test adapter

Production builds expose a deliberately small adapter for black-box tests on
`window`:

```js
window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase,
    score,
    lives,
    playerX,
    playerY,
    enemyCount,
    projectileCount,
  }),
  endGameForTest: (score) => {
    /* transition through the normal game-over flow */
  },
};
```

For example, after the app has loaded, a test may call
`window.__NEON_BARRAGE__.getState()` and then
`window.__NEON_BARRAGE__.endGameForTest(1234)`. The supplied score must be a
non-negative integer. `endGameForTest` uses the same game-over, name-validation,
and submit UI as normal gameplay; it does not write to Supabase directly or
bypass client or database validation.

Stable test selectors are:

`[data-testid="game-canvas"]`, `[data-testid="start-button"]`,
`[data-testid="score"]`, `[data-testid="lives"]`,
`[data-testid="mute-button"]`, `[data-testid="leaderboard"]`,
`[data-testid="player-name"]`, `[data-testid="submit-score"]`, and
`[data-testid="touch-controls"]`.

## Architecture

- The browser owns the real-time 2D canvas render loop, input handling,
  movement, firing, enemy spawning, collisions, score/lives state, difficulty,
  sound, and the deterministic adapter.
- DOM/CSS UI surrounds the canvas for the HUD, start/game-over flow, leaderboard,
  mute control, and responsive touch controls. The production artifact is
  static output (normally `dist/`); no application server is required.
- The frontend uses the Supabase URL and publishable key to call the Supabase
  Data API. It reads the leaderboard and inserts a final score; it never needs
  a server-side service-role key.
- `supabase/migrations/` is the reproducible database source of truth. The
  migration creates the leaderboard schema, constraints, RLS, and minimum
  public policies.

## Local checks

Run the checks from the repository root:

```sh
npm run test
npm run typecheck
npm run build
```

Use `npm run dev` for interactive play. To inspect the generated artifact
directly, serve `dist/` with any static HTTP server, for example
`python3 -m http.server 4173 --directory dist`. A clean integration must pass
the automated tests, typecheck, and production build before upload.

## Supabase project and migration setup

1. Create or select a new Supabase project in the designated organization.
   Use a project name beginning with
   `shootemup-bench-<treatment>-`, where `<treatment>` is the run’s actual
   treatment identifier. The project reference and URL are identifiers, not
   substitutes for credentials.
2. Obtain the project URL and its publishable/anon key from the Supabase API
   settings and provide them to the local runtime config as `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` (the browser config fields are `supabaseUrl` and
   `supabaseAnonKey`).
3. Apply the checked-in migration with the Supabase CLI. After authenticating
   the CLI using a secret kept outside the repository, link the project and
   push migrations:

   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   The migration under `supabase/migrations/` must be applied to the new
   project; do not recreate its policies manually with a different schema.
4. Confirm in the Supabase dashboard that the exposed leaderboard table has
   RLS enabled and that the public role has only the intended read and insert
   permissions. Test one valid submission and one invalid name/score before
   deployment.

The browser artifact includes the public values from its runtime config.
Changing Supabase variables or `public/config.js` after `dist/` is built does
not change that artifact; rebuild before uploading.

## Cloudflare Pages direct upload

Build with the production Supabase values in the environment, then upload the
static output directly to a Pages project:

```sh
npm ci
npm run build
npx --no-install wrangler pages project create shootemup-bench-<treatment> \
  --production-branch main
npx --no-install wrangler pages deploy dist \
  --project-name shootemup-bench-<treatment>
```

Create the Pages project once; on later releases, run only the build and deploy
commands. Populate the runtime config from `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` before `npm run build`. Authenticate Wrangler with `CLOUDFLARE_API_TOKEN` (and
`CLOUDFLARE_ACCOUNT_ID` if required by the account). The project name must keep
the `shootemup-bench-<treatment>-` naming prefix required by the benchmark.
Because this is a direct upload, only the generated static `dist/` files are
uploaded. If Pages performs the build instead, configure only
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as production build variables and
keep management secrets out of the build environment and output.

## Security decisions

- Only the Supabase project URL and publishable/anon key are allowed in browser
  code. Browser configuration is public by design; never use or embed a
  Supabase service-role key, database password, Cloudflare token, or Supabase
  management token in the frontend.
- RLS is enabled on every table in the exposed schema. Public access is limited
  to the leaderboard operations the game needs: reading leaderboard rows and
  inserting a score. Public update, delete, arbitrary table access, and schema
  changes are not part of the client contract.
- Database constraints/policies validate the player name length (1–16
  characters) and a plausible non-negative integer score. JavaScript checks are
  for user experience only and are not the security boundary.
- A public client cannot make client-generated scores tamper-proof. The design
  limits malformed or unauthorized database operations with RLS and
  database-side validation while keeping privileged credentials off the page.
