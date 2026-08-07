# Neon Barrage

Neon Barrage is a responsive, canvas-based synthwave shoot-'em-up. It combines a deterministic, testable game engine with a small DOM/rendering layer and a persistent public Supabase leaderboard. The production frontend is a static Vite build deployed to Cloudflare Pages.

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
# Fill in the Supabase URL and public publishable/anon key.
npm run dev
```

Quality checks:

```bash
npm test
npm run build
```

## Controls

- Move: Arrow keys or WASD
- Fire: Space
- Mobile/touch: on-screen directional pad and fire button
- Sound: header mute toggle; Web Audio starts only after a user gesture

## Architecture

- `src/engine.js`: framework-independent game state and update loop (movement, spawning, projectiles, collision, lives, scoring, and difficulty).
- `src/main.js`: canvas renderer, input adapters, audio synthesis, UI state, stable test adapter, and Supabase REST calls.
- `src/style.css`: responsive visual system and touch layout.
- `supabase/migrations`: reproducible leaderboard table, constraints, grants, index, and RLS policies.
- `test/engine.test.js`: meaningful Node tests for state, controls, collision/scoring, and game-over validation.

## Supabase and security

Create a fresh Supabase project, then execute the migration with the CLI or SQL editor. Configure the browser with only the project URL and a publishable (or legacy anon) public key. Never use a secret/service-role key in `VITE_*` variables.

The exposed `public.leaderboard` table has RLS enabled. Browser roles receive only `SELECT` and `INSERT`; rows cannot be updated or deleted. Both CHECK constraints and the INSERT policy enforce a trimmed 1–16 character callsign from an allowlist and an integer score between 0 and 10,000,000. Ordering and the top-10 limit are applied when reading. This simple anonymous arcade board cannot fully prevent a determined client from fabricating an in-range score; authoritative anti-cheat would require server-side gameplay verification.

## Deploy

```bash
npm ci
VITE_SUPABASE_URL=https://REF.supabase.co \
VITE_SUPABASE_PUBLIC_KEY=PUBLIC_KEY npm run build

export CLOUDFLARE_API_TOKEN=...
npx wrangler pages project create shootemup-bench-monolith-sol-medium-neon-barrage --production-branch main
npm run deploy
```

The production test adapter intentionally exposes only state inspection and a validated transition into the same game-over flow used during real play:

```js
window.__NEON_BARRAGE__.getState()
window.__NEON_BARRAGE__.endGameForTest(1234)
```
