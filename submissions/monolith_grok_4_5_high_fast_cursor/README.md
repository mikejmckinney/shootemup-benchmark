# Neon Barrage

Browser shoot-’em-up with a persistent Supabase leaderboard, deployed to Cloudflare Pages.

## Local setup

```bash
npm install
cp .env.example .env
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (anon/public key only)
npm run dev
```

Useful scripts:

- `npm run build` — typecheck + production bundle
- `npm run typecheck` / `npm run lint` — TypeScript checks
- `npm test` — Vitest gameplay/validation tests

## Controls

- **Move:** Arrow keys or WASD
- **Fire:** Space
- **Touch:** on-screen pad + Fire (shown on narrow viewports)
- **Mute:** Sound On / Muted toggle (Web Audio starts only after interaction)

## Architecture

- **Vite + TypeScript** canvas game (`src/game/Game.ts`) with neon visual direction, particles, escalating spawn/fire rates, lives, and game-over/restart.
- **Web Audio** synth SFX in `src/game/audio.ts`.
- **Supabase** leaderboard client in `src/leaderboard.ts` using the anon key only.
- **Test adapter:** `window.__NEON_BARRAGE__` exposes `getState` and `endGameForTest` for black-box checks without bypassing DB validation.
- **Schema:** `supabase/migrations/001_leaderboard.sql` (RLS, check constraints for name/score).

## Security decisions

- Browser receives only the Supabase **anon/public** key.
- RLS enabled on `leaderboard`; policies allow `SELECT` and `INSERT` only for `anon`/`authenticated`.
- No update/delete policies for the public roles.
- Name (1–16, safe charset) and score bounds are enforced with SQL `CHECK` constraints and insert `WITH CHECK` clauses, not only in JS.

## Deployment

1. Apply `supabase/migrations/001_leaderboard.sql` to the Supabase project.
2. Build with env vars set:

```bash
export VITE_SUPABASE_URL=...
export VITE_SUPABASE_ANON_KEY=...
npm run build
```

3. Deploy static assets:

```bash
npx wrangler pages deploy dist --project-name=shootemup-bench-monolith-grok-4-5-high-fast-cursor-web
```

Resource naming prefix: `shootemup-bench-monolith_grok_4_5_high_fast_cursor-`.
