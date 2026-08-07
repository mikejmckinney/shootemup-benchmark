# Neon Barrage Platform Layer

This repository contains the persistent leaderboard boundary and deployment/quality tooling for Neon Barrage. The browser game is expected to build into `dist/`; the platform layer does not require or expose a service-role credential.

## Local Setup

Prerequisites:

- Node.js 20 or newer for the dependency-free quality tests.
- Docker, the [Supabase CLI](https://supabase.com/docs/guides/cli), and the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/).
- `curl` for HTTP verification and `jq` for safe round-trip payload encoding.

Start the local Supabase stack from the repository root:

```sh
supabase start
supabase db reset
node --test tests/*.test.mjs
supabase status
```

`supabase db reset` applies every file in `supabase/migrations/` to a clean local database. The local API URL and browser-safe anonymous key are printed by `supabase status`. The frontend should receive them through its local environment configuration, for example:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<value-from-supabase-status>
```

Only the URL and anonymous/publishable key belong in browser configuration. Never put `SUPABASE_SERVICE_ROLE_KEY`, a database password, or a management token in frontend code, `dist/`, or committed files.

## Architecture

- `supabase/migrations/20260807000000_create_leaderboard.sql` is the source of truth for the public leaderboard table, constraints, grants, index, and RLS policies.
- The game client reads `public.leaderboard` through the Supabase REST API or JavaScript client, ordering by `score` descending and then `created_at`/`id` ascending, and limiting the result to at least 10 rows.
- The game-over UI submits only `{ player_name, score }`. The database supplies `id` and `created_at`.
- `wrangler.toml` configures the Cloudflare Pages output directory as `dist` and provides the benchmark-safe Pages project name.
- `deployment/verify.sh` checks the deployed HTTP response and public leaderboard read. Set `VERIFY_ROUND_TRIP=1` to additionally exercise a real anonymous insert and returned-row read.

The expected client calls are equivalent to:

```js
const { data: rows, error } = await supabase
  .from('leaderboard')
  .select('id, player_name, score, created_at')
  .order('score', { ascending: false })
  .order('created_at', { ascending: true })
  .order('id', { ascending: true })
  .limit(10);

const { data: row, error } = await supabase
  .from('leaderboard')
  .insert({ player_name: name, score })
  .select('id, player_name, score, created_at')
  .single();
```

The UI must still handle loading, empty, validation, and network-error states. Client-side validation is useful for feedback, but it is not a security boundary; the migration constraints are authoritative.

## Data And Security

`public.leaderboard` contains:

| Column | Rule |
| --- | --- |
| `id` | Server-generated identity primary key |
| `player_name` | Required text, 1–16 characters, no surrounding whitespace or control characters |
| `score` | Required PostgreSQL integer from 0 through 1,000,000,000 |
| `created_at` | Server-generated UTC timestamp |

Row-level security is enabled on the table. Both `anon` and `authenticated` may:

- Read leaderboard rows.
- Insert only the `player_name` and `score` columns, subject to database constraints.

They may not update, delete, truncate, or set the identity/timestamp columns. The public API therefore exposes the minimum operations needed by the game. The `leaderboard_score_created_at_id_idx` index supports the ranking query. A trusted server-side `service_role` process may retain administrative access through Supabase's server-only role behavior, but that credential must never be sent to the browser.

The name policy rejects empty, overlong, padded, and control-character values. The score policy rejects negative, fractional, non-integer, and implausibly large values. PostgreSQL type checking and constraints remain in force regardless of how the REST request is formed.

## Quality Checks

Run the repository's platform checks with:

```sh
node --test tests/*.test.mjs
```

The tests inspect the migration contract for its schema, validation constraints, RLS enablement, role/policy grants, server-owned columns, and absence of credential material. If the Supabase CLI and Docker are available, also run `supabase db reset` and inspect the resulting API behavior with the local anonymous key.

## Deployment

### Supabase

Create or select the benchmark Supabase project using the required `shootemup-bench-<treatment>-` prefix. Link the local repository to that project and push the migration:

```sh
export SUPABASE_PROJECT_REF=<project-ref>
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

Use the Supabase management credential only through the CLI's authenticated session or an environment variable expected by the CLI. Do not write it into this repository. Confirm the project URL and browser-safe key in the Supabase dashboard or CLI output.

### Cloudflare Pages

Build the frontend using its pinned project dependencies, then deploy the generated `dist/` directory. The project name configured in `wrangler.toml` is `shootemup-bench-a2a-async-streaming-opencode-neon-barrage`:

```sh
npm ci
npm run build
npx wrangler pages deploy dist --project-name shootemup-bench-a2a-async-streaming-opencode-neon-barrage
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages build/runtime variables through the Cloudflare dashboard or Wrangler. Rebuild after changing build-time variables. Do not configure a service-role key in Pages variables exposed to the client bundle.

## Production Verification

Set the URL and browser-safe key, then run the checked-in smoke test:

```sh
PRODUCTION_URL=https://<pages-domain> \
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<public-anon-or-publishable-key> \
sh deployment/verify.sh
```

For a real insert/read round trip, use a unique 1–16 character test name and a non-negative integer score:

```sh
PRODUCTION_URL=https://<pages-domain> \
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<public-anon-or-publishable-key> \
VERIFY_ROUND_TRIP=1 \
VERIFY_PLAYER_NAME=QA2026 \
VERIFY_SCORE=12345 \
sh deployment/verify.sh
```

The script requires HTTP 200 from the production URL and a JSON-array leaderboard response. With `VERIFY_ROUND_TRIP=1`, it requires an insert response and a separate persisted GET containing the submitted row. Public delete is intentionally unavailable, so a round-trip verification row remains in the leaderboard. Record the actual production URL, project reference, public key, HTTP status, round-trip result, and test result in the coordinator-owned `benchmark-result.json`; this platform layer does not fabricate live verification evidence.
