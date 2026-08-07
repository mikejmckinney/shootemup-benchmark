# Neon Barrage

> Gallery integration: the deployed game now uses the benchmark's shared Supabase project and reads/writes only the `monolith` leaderboard partition. The original migration below remains the candidate's historical benchmark artifact; the shared integration migration is [`../../supabase/migrations/20260805211711_shared_leaderboard.sql`](../../supabase/migrations/20260805211711_shared_leaderboard.sql).

Neon Barrage is a single-screen browser shoot-'em-up set above a glowing orbital ring. Pilot the interceptor, survive escalating waves, and publish your final score to the global top ten.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local
npm run check
npm run dev
```

The game remains playable without Supabase configuration; its leaderboard then shows a clear local-preview/offline state. The migration in [`supabase/migrations/20260805143000_create_leaderboard.sql`](supabase/migrations/20260805143000_create_leaderboard.sql) is the complete remote schema and policy definition.

## Controls

- Move with WASD or the Arrow keys.
- Fire with Space.
- On narrow screens, use the on-screen directional pad and FIRE button.
- Press Escape to pause/resume.
- Use the upper-right sound control to mute generated Web Audio feedback.

Audio is created only from a user gesture (launch, mute, canvas focus, or touch control). The public test adapter is available in production as `window.__NEON_BARRAGE__`:

```js
window.__NEON_BARRAGE__.getState();
window.__NEON_BARRAGE__.endGameForTest(1200);
```

The adapter validates the score and routes through the same game-over form used by a normal run. It never writes to the database itself.

## Architecture

- `src/main.js` owns the canvas loop, input, rendering, Web Audio, game-over flow, leaderboard UI, and Supabase client.
- `src/gameLogic.js` contains deterministic, dependency-free rules for score/name validation, collisions, enemy scoring, and difficulty. It is covered by Vitest.
- `src/styles.css` defines the responsive neon/orbital visual system and the mobile touch layout.
- The app is built as a Vite static bundle and served by Cloudflare Workers Static Assets via `wrangler.jsonc`.

The canvas uses a fixed 900×600 simulation coordinate system with responsive CSS scaling. Enemies, friendly and hostile projectiles, particles, lives, collision checks, invulnerability, wave escalation, pause, and restart all run in the same animation loop.

## Data and security

The browser receives only the Supabase project URL and publishable key. It never receives a service-role or secret key. The public `leaderboard` table has RLS enabled, grants only `SELECT` and `INSERT` to `anon`/`authenticated`, and has no public update or delete policy. Both the insert policy and database `CHECK` constraints enforce a trimmed 1–16 character name and a non-negative 32-bit integer score. The client repeats those checks for fast feedback, but the database remains authoritative.

## Deployment

1. Create or use a Supabase project and apply the migration. Retrieve its URL and publishable key.
2. Build with the public values available at build time:

   ```bash
   VITE_SUPABASE_URL=https://YOUR_REF.supabase.co \
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
   npm run build
   ```

3. Authenticate Wrangler with a Cloudflare API token that can deploy Workers and run:

   ```bash
   npx wrangler deploy
   ```

`wrangler.jsonc` names the resource with the required `shootemup-bench-monolith-` prefix and serves `dist` as static assets. A production smoke test should check HTTP 200, load the canvas, call the test adapter, submit a valid callsign, read the resulting top-ten entry, and reload to confirm persistence.
