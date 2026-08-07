# Neon Barrage

> Gallery integration: the deployed game now uses the benchmark's shared Supabase project and reads/writes only the `monolith_sol_medium_opencode` leaderboard partition. The original migration below remains the candidate's historical benchmark artifact; the shared integration migrations are in [`../../supabase/migrations/`](../../supabase/migrations/).

A responsive canvas shoot-'em-up with keyboard/touch controls, generated Web Audio, escalating enemies, and a persistent Supabase leaderboard.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and provide the Supabase project URL and public anon/publishable key.
3. Run `npm run dev`.

Quality checks: `npm test`, `npm run typecheck`, and `npm run build`. Run the browser smoke test against a live or local URL with `PRODUCTION_URL=https://example.pages.dev npm run test:production` (install Playwright Chromium once with `npx playwright install chromium`).

## Controls

- Move with Arrow keys or WASD.
- Fire with Space.
- On narrow screens, use the directional pad and FIRE control.
- Sound begins only after a user launches, touches a control, or toggles sound.

## Architecture

The UI and real-time loop are plain JavaScript rendered in a fixed-resolution canvas that scales responsively. `src/game-core.js` contains testable collision, difficulty, and validation rules. The leaderboard talks directly to Supabase's PostgREST API using the browser-safe public key. Network failures remain isolated from gameplay.

## Data security

`supabase/migrations/20260806000000_leaderboard.sql` reproduces the schema. RLS is enabled and grants anonymous users only `SELECT` and `INSERT`; there are no public update/delete policies. Database constraints and insert policy checks enforce trimmed 1–16 character alphanumeric names (plus spaces, `_`, `-`) and integer scores from 0 through 10,000,000. No service-role credential is shipped to the browser.

## Deployment

Build with the production `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLIC_KEY` environment variables using `npm run build`, then deploy `dist/` to Cloudflare Pages or Workers static assets. Apply the included migration to a new Supabase project before deployment.
