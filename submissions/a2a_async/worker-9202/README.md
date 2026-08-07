# Neon Barrage leaderboard data layer

This worker owns the Supabase data-layer handoff for Neon Barrage. It does not
contain or deploy the game frontend. The coordinator should copy or integrate
the migration and `src/leaderboard-client.js` into the frontend repository,
then perform the live Supabase and Cloudflare setup described below.

## Contents

- `supabase/migrations/*_create_leaderboard.sql` creates `public.leaderboard`.
- `src/leaderboard-client.js` creates a browser-safe client and a small stateful
  data layer for loading and submitting the top scores.
- `test/leaderboard-client.test.mjs` exercises validation, state transitions,
  failure recovery, and the Supabase query shape using a fake client.
- `test/migration.test.mjs` is a local guard that checks the migration's
  constraints, grants, and policies are still present.
- `package-lock.json` pins the `@supabase/supabase-js` dependency for the
  integration module.

## Database contract

The migration creates this append-only public surface:

| Field | Type | Contract |
| --- | --- | --- |
| `id` | `bigint` identity | Server-generated primary key |
| `name` | `text` | Trimmed ASCII display name matching `[A-Za-z0-9][A-Za-z0-9 _-]{0,15}` |
| `score` | `integer` | Inclusive range `0..100,000,000` |
| `created_at` | `timestamptz` | Server default `now()`; not writable by public clients |

The database checks are authoritative. The browser module repeats them for
fast feedback, but a caller cannot bypass the database constraint by skipping
JavaScript validation.

The migration enables RLS and grants only `SELECT` plus column-scoped
`INSERT(name, score)` to `anon` and `authenticated`. There are no public
`UPDATE` or `DELETE` grants. The two RLS policies allow public reads and
validated appends; the table constraints enforce the actual name and score
rules. The identity sequence receives only the usage privilege needed for
server-generated IDs.

## Frontend integration

Install the pinned dependency in the frontend package (or reuse this package's
lockfile when the data layer is kept as a workspace package):

```sh
npm install @supabase/supabase-js@2.112.1
```

Use public build-time variables only. For Vite, for example:

```sh
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-legacy-anon-key>
```

Do not place `SUPABASE_SERVICE_ROLE_KEY`, an `sb_secret_*` key, or any server
credential in a `VITE_*` variable. `createBrowserLeaderboardClient` rejects
obvious secret-key prefixes, but key handling remains a deployment concern.

Minimal wiring:

```js
import {
  createLeaderboardDataLayer,
} from './leaderboard-client.js';

const leaderboard = createLeaderboardDataLayer({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  limit: 10,
});

leaderboard.subscribe(({ status, entries, error }) => {
  // Render into [data-testid="leaderboard"] without using innerHTML for names.
  // loading: spinner/skeleton; empty: friendly first-score message;
  // ready: rows; error: retry message while gameplay remains usable.
  renderLeaderboard({ status, entries, error });
});

await leaderboard.load();

// On the shared game-over/submit path:
const result = await leaderboard.submitScore(nameInput.value, finalScore);
if (!result.ok) showScoreError(result.error.message);
```

`submitScore` trims the name, validates it and the score locally, inserts only
`name` and `score`, and refreshes the ordered top-N list. It returns
`{ ok: false, error, state }` for validation or insert failures, and does not
throw network errors. If the insert succeeds but the refresh fails, it returns
`{ ok: true, entry, warning, state }` so the UI does not tell a player to retry
and accidentally create a duplicate. Keep the game playable for `loading`,
`empty`, and `error` states; a leaderboard outage must not block restart.

The query ordering is score descending, then creation time and identity ID
ascending for deterministic ties. Render `name` with text APIs such as
`textContent`; never interpolate it into HTML.

## Local verification

The pinned Supabase client currently requires Node 22 or newer.

From this directory:

```sh
npm ci
npm run verify
```

`npm run verify` runs JavaScript syntax checks, fake-client behavior tests, and
the migration contract guard. These tests intentionally do not claim a live
Supabase round trip. The coordinator must perform the live checks after
creating the project.

## Existing shared-tree compatibility

The shared candidate tree already contains a root frontend that reads
`public.leaderboard(name, score, created_at)` and an earlier table-creation
migration with the same table name. This worker intentionally uses that same
column contract, so the coordinator can integrate `src/leaderboard-client.js`
without renaming the frontend's `name` field.

Do not apply both table-creation migrations to one project. For a fresh project,
use this worker migration as the canonical create migration. If the coordinator
keeps the root migration because it has already been applied, use a follow-up
migration to adopt this worker's column-scoped insert grant and review its
constraints/policies against this file; do not run this `create table` statement
again. The existing root schema's UUID `id` is compatible with this module,
which treats `id` as an opaque returned value. The privilege hardening for that
already-created table is:

```sql
revoke all on table public.leaderboard from anon, authenticated;
grant select on table public.leaderboard to anon, authenticated;
grant insert (name, score) on table public.leaderboard to anon, authenticated;
```

Keep the existing RLS policies only after confirming their `WITH CHECK` and
database constraints match this worker's contract.

## Live Supabase setup and verification handoff

1. Create the new Supabase project with the benchmark-required
   `shootemup-bench-<treatment>-...` name in organization
   `xfbsknprvxldvgioaows`.
2. Apply the migration through the Supabase SQL editor or the coordinator's
   normal migration workflow. Confirm `public.leaderboard` is exposed through
   the Data API. If project defaults are disabled, the explicit grants in the
   migration are the intended API access; do not broaden them.
3. In the project dashboard, confirm RLS is enabled and inspect the two
   policies. Check that `anon` can select and insert valid rows, while update
   and delete are rejected. Try invalid names (empty, 17+ characters, or
   punctuation outside the documented character set) and scores below zero,
   above `100,000,000`, or
   non-integers; the database must reject each one even if sent directly.
4. From the deployed browser origin, call `load()` and verify the loading,
   empty/populated, and network-error UI states. Call `submitScore()` with the
   anon key and then reload the page to verify persistence and descending top-10
   ordering. This is the required real insert/read round trip.
5. Deploy the coordinator-owned frontend to Cloudflare Pages/Workers. Set only
   the public Supabase URL and anon/publishable key as frontend build variables.
   Keep the service-role key out of source, build output, browser requests, and
   Cloudflare public variables. Configure any anti-spam/rate limiting at the
   coordinator's edge layer; RLS is not an abuse-rate limiter.

The final benchmark artifact must be written by the coordinator at the
candidate root, not in this worker directory, after the production HTTP check
and live leaderboard round trip actually pass.
