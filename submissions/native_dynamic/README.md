# Neon Barrage

> Gallery integration: the deployed game now uses the benchmark's shared Supabase project and reads/writes only the `native_dynamic` leaderboard partition. The original migration below remains the candidate's historical benchmark artifact; the shared integration migration is [`../../supabase/migrations/20260805211711_shared_leaderboard.sql`](../../supabase/migrations/20260805211711_shared_leaderboard.sql).

Neon Barrage is a responsive canvas shoot-'em-up with keyboard/touch controls,
gesture-gated Web Audio, and a persistent Supabase leaderboard. Cloudflare
Pages serves the static Vite build; the browser uses only the Supabase public
publishable key.

No credentials are stored in this repository. `benchmark-result.json` is
created only after the live deployment and public leaderboard round trip pass.

## Local setup

The repository contains pinned dependency versions and a committed lockfile.
Once the lockfile is present:

1. Use the Node.js version required by the frontend toolchain (Node 20 LTS or
   newer is the baseline for this handoff).
2. Install exactly the committed dependency graph:

   ```sh
   npm ci
   ```

3. Supply the Supabase URL and browser-safe public key through the shell or a
   secret manager. Do not commit a `.env` file or paste real values into this
   README. The frontend's chosen variable names must be used consistently; the
   conventional Vite names are shown here only as placeholders:

   ```sh
   VITE_SUPABASE_URL='https://<project-ref>.supabase.co' \
   VITE_SUPABASE_ANON_KEY='<public-anon-key>' \
   npm run dev
   ```

   A Supabase anon/publishable key is designed for browser use, but it is still
   configuration and must never be confused with a service-role/secret key.
4. Build the static artifact and run the implementation checks:

   ```sh
   npm run build
   npm run typecheck
   npm test
   ```

   The manifest includes a Vitest gameplay-math suite; run it with `npm test`.
5. Preview the built artifact through the Pages local server:

   ```sh
   npx wrangler pages dev ./dist
   ```

The dependency-free release preflight can validate the scaffolding even before
the frontend build produces `dist/`:

```sh
node scripts/verify-release.mjs
```

After the frontend handoff has produced `dist/index.html`, require the full
artifact checks:

```sh
node scripts/verify-release.mjs --require-dist
```

## Controls and required test surface

The shipped game must make these controls available after a deliberate user
gesture:

- Start/restart: the visible start control and the game-over restart flow.
- Move: Arrow keys or `W`, `A`, `S`, `D`.
- Fire: `Space`.
- Mobile: visible touch controls on narrow viewports; they must not cover the
  score, lives, or leaderboard UI.
- Audio: a visible mute control. Web Audio must be created/resumed only after
  user interaction.

The implementation must preserve these stable selectors because they are the
black-box test contract:

| Surface | Selector |
| --- | --- |
| Game canvas | `[data-testid="game-canvas"]` |
| Start control | `[data-testid="start-button"]` |
| Score | `[data-testid="score"]` |
| Lives | `[data-testid="lives"]` |
| Mute control | `[data-testid="mute-button"]` |
| Leaderboard | `[data-testid="leaderboard"]` |
| Name input | `[data-testid="player-name"]` |
| Submit score | `[data-testid="submit-score"]` |
| Touch controls | `[data-testid="touch-controls"]` |

For deterministic tests, production code must expose:

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
    // Use the same game-over and score-submission UI as normal gameplay.
  },
};
```

`endGameForTest` must accept only the same non-negative integer score range that
the real game accepts. It must transition through the normal game-over state;
it must not write directly to Supabase or bypass the name/database validation.

## Architecture

```text
Cloudflare Pages
  └── dist/ (static HTML/CSS/JS and game assets)
      └── Browser
          ├── canvas game loop: input, movement, firing, enemies, collisions
          ├── UI state: score, lives, difficulty, game-over, restart, errors
          ├── Web Audio: user-gesture-gated effects + visible mute state
          └── Supabase public API: leaderboard read/insert using public key
```

There is no Pages Function or Worker in this release scaffold. Cloudflare's
job is static delivery and TLS/CDN; it is not a place to put a Supabase
service-role secret. The browser owns real-time play and talks to Supabase only
with the public client configuration. Supabase RLS and database constraints,
not JavaScript alone, define what a public client may read or insert.

## Supabase migration and application

The migration at `supabase/migrations/20260805161509_create_leaderboard.sql`
defines
`public.leaderboard` with database-generated UUID/timestamps, a 1–16 character
name constraint, a restricted name-character constraint, a score range of
0–1,000,000,000, and RLS. Before a production deployment, review the migration
against this contract:

- Every table in an exposed schema has RLS enabled.
- The public client can select only the leaderboard data needed to show the top
  10 and can insert a score. It cannot update or delete leaderboard rows.
- The database validates the player name as 1–16 characters and validates the
  score as a plausible non-negative integer. These checks must be database
  constraints or equivalent database-side validation, not only JavaScript
  checks.
- Ordering is descending by score with a deterministic tie-breaker, so the
  displayed top 10 is stable. The current migration supplies a supporting
  score/created-at/id index; verify the deployed query and tie direction in the
  browser smoke test.
- The migration is repeatable locally and does not grant public access to
  service-role credentials or unrelated tables/functions.

Local migration application, after the migration handoff arrives:

```sh
supabase start
supabase db reset
```

The reset should create the schema, policies, and any required indexes from a
clean local database. Inspect the generated API behavior with the public key;
do not use a service-role key to make an ordinary browser request pass.

For a new project, apply the migration with the Supabase CLI or management
tooling. The benchmark deployment applied this migration to the configured
project:

```sh
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

If the CLI needs a management token, expose it only in the invoking shell or
CI secret store (`SUPABASE_ACCESS_TOKEN`; the benchmark environment may name
the same credential `SUPABASE_API_KEY`). Never put it in a migration, config,
log, artifact, or frontend environment bundle. A release operator should
inspect the migration diff and target project before allowing `supabase db
push`.

The `src/leaderboard.ts` client reads `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, uses the public REST API with the anon key, and has a
local demo fallback when those values are absent. The release test must prove
the configured Supabase path, not mistake demo fallback data for a persistent
leaderboard.

At runtime, the UI should show loading, empty, validation, and network-error
states without making the game unplayable. A score round trip is complete only
when the normal game-over form accepts a valid name, the public insert returns
success, the row appears in the sorted leaderboard, and a page reload still
shows it. Invalid names and implausible scores must be rejected by both the UI
and the database.

## Cloudflare Pages deployment

[`wrangler.toml`](./wrangler.toml) is a Pages configuration, not a Worker
script. It intentionally contains only:

- the normalized project name `shootemup-bench-native-dynamic-neon-barrage-pages`;
- `pages_build_output_dir = "./dist"`;
- an explicit compatibility date; and
- disabled Wrangler usage metrics.

There are no Cloudflare bindings, environment variables, IDs, or secrets in
the file. The frontend build output contains the complete static site in
`dist/`.

The project name uses `native-dynamic` rather than the directory's
`native_dynamic`: Cloudflare resource names accept alphanumeric characters and
dashes, so the underscore is normalized while preserving the required
`shootemup-bench-<treatment>-` prefix. If the benchmark controller supplies a
different approved slug, update the name in the config and the release checks
together before deployment.

After local build, migration, and verification are green, an operator with the
Cloudflare credential may create/link the Pages project and deploy the artifact:

```sh
npx wrangler pages deploy ./dist --project-name shootemup-bench-native-dynamic-neon-barrage-pages --branch main
```

Use the first command only when the project does not already exist. When the
project is already linked, the deploy command reads `wrangler.toml` and uses
`./dist`. The benchmark environment may provide `CLOUDFLARE_API_KEY`; Wrangler
expects `CLOUDFLARE_API_TOKEN`, so an operator may map the variable in the
process environment for one invocation. Do not save that mapping in a file.

The release was deployed with the equivalent authenticated Wrangler command.

## Verification and release gate

The standalone [`scripts/verify-release.mjs`](./scripts/verify-release.mjs)
performs read-only checks with Node built-ins only:

- validates the Pages config, project-name prefix, output directory, and
  compatibility date;
- when `--require-dist` is supplied, requires `dist/index.html`, checks for the
  required selector/test-adapter markers, and scans the build artifact for
  obvious management/private credential patterns; and
- with `--url <https-url>`, checks a deployed HTML response and same-origin
  script assets for HTTP 200 and the required test markers. It never writes to
  Cloudflare or Supabase.

Run the local checks as follows:

```sh
node scripts/verify-release.mjs
node scripts/verify-release.mjs --require-dist
```

Run the read-only production smoke check only after a deployment exists:

```sh
node scripts/verify-release.mjs --url "$NEON_BARRAGE_URL"
```

The script cannot replace browser interaction or the Supabase round-trip test.
The final release gate must also use a browser harness to verify keyboard and
touch controls, canvas/game-over behavior, mute behavior after user gesture,
the deterministic test adapter, validation/error states, and a real insert →
top-10 read → page-reload read using the public client. Do not call Supabase
directly from the test adapter.

Only after all of the following are evidenced should the release operator write
the benchmark result artifact:

1. the production URL returns HTTP 200;
2. the browser smoke flow passes the required selectors and controls;
3. the leaderboard insert/read survives a page reload; and
4. local tests and the release preflight pass.

Until then, the status is not `complete` and no live URL or public key should
be guessed in `benchmark-result.json`.

## Release evidence

The checked-in `benchmark-result.json` records the exact Cloudflare and
Supabase resources used for this release. Re-run
`node scripts/verify-release.mjs --require-dist` and the production URL smoke
check after any future deployment.
