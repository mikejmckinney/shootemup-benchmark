# Neon Barrage Validation Quickstart

This guide validates the implementation locally, against the remote schema, and at
the production URL. It does not replace the migration, test suite, or deployment
artifacts.

## Prerequisites

- Node.js 20 LTS and npm
- A modern Chromium-based browser for Playwright smoke tests
- Supabase CLI and Wrangler CLI
- The approved treatment identifier
- `SUPABASE_API_KEY` and `CLOUDFLARE_API_KEY` in the environment; map them to the
  provider-specific token variables only when a CLI requires it
- A newly created treatment-prefixed Supabase project and Cloudflare Pages project

The public build configuration uses only `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Never put management or service-role credentials in these
variables.

## Install and Configure

```sh
npm ci
cp .env.example .env.local
```

Set the public URL and anonymous key in `.env.local`. Do not commit that file.

## Local Quality Gates

Run the gates in this order:

```sh
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
```

Expected outcomes:

- Lint, type checking, unit tests, UI integration tests, and browser tests exit 0.
- Engine tests cover movement bounds, firing, collision, scoring, lives,
  difficulty, game-over, restart, and deterministic test-adapter transitions.
- Validation tests cover valid names, invalid names, integer score bounds, and safe
  display of submitted text.
- Browser tests locate every selector in `contracts/ui-test-surface.md`, exercise
  the normal flow, and confirm the test adapter uses the same game-over UI.
- The production bundle contains no management or service-role credential string.

## Local Browser Smoke

Start the development server:

```sh
npm run dev
```

At the displayed local URL:

1. Confirm the start state, score, lives, mute control, and leaderboard states are
   visible.
2. Start a run and use Arrow keys or WASD plus Space. Confirm movement, firing,
   collisions, score, lives, and escalating pressure.
3. Use touch controls at a narrow viewport and keyboard navigation for every form and
   control.
4. Activate `window.__NEON_BARRAGE__.endGameForTest(1234)` from the browser console.
   Confirm the normal game-over panel appears, then submit a unique valid name.
5. Exercise blank, overlong, control-character, negative, fractional, and oversized
   values. Confirm no invalid value is submitted.
6. Force or simulate loading, empty, and network-error states. Confirm gameplay is
   still usable and Retry preserves the final score.

## Apply and Check the Supabase Schema

Link the new project and apply the committed migration:

```sh
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

Verify the migration has one exposed leaderboard table, RLS enabled, select and
insert available to the public role, and update/delete unavailable. Attempt invalid
names and scores through the public key and confirm the database rejects them.

## Build and Deploy

Build the immutable production assets:

```sh
npm run build
```

Create or reuse the treatment-prefixed Pages project, then deploy the `dist` output:

```sh
npx wrangler pages project create "$CLOUDFLARE_PROJECT"
npx wrangler pages deploy dist --project-name "$CLOUDFLARE_PROJECT"
```

Record the actual Pages URL. Do not pause the Supabase project; the benchmark
controller performs that action after verification.

## Production Verification

Run the production browser smoke and public persistence check:

```sh
npm run verify:production -- "$CLOUDFLARE_URL"
```

The verification must:

- receive HTTP status 200 from the public URL;
- locate the required selectors and start the game;
- exercise game-over through normal play or the test adapter;
- submit a unique valid name and score through the normal form;
- read the entry from the public leaderboard and reload the page;
- confirm the entry remains visible and the list is correctly ordered;
- confirm the public bundle exposes no protected credential.

Only after every check passes may `benchmark-result.json` be written with
`status: "complete"`. If a check fails or was not run, record the actual failure and
do not claim completion.
