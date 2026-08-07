# Neon Barrage

Polished browser shoot-’em-up with a Supabase-backed leaderboard, deployed to Cloudflare Pages.

## Local setup

```bash
npm install
cp .env.production .env   # or set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Commands:

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` / `npm run lint` | TypeScript check |
| `npm test` | Vitest unit tests |
| `npm run preview` | Preview `dist/` |

## Controls

- **Move:** Arrow keys or WASD
- **Fire:** Space
- **Mute:** `Sound On/Off` button (Web Audio starts only after a user gesture)
- **Touch:** on-screen D-pad + FIRE on narrow viewports

## Architecture

- `src/game.ts` — simulation (entities, collisions, difficulty, test adapter helpers)
- `src/render.ts` — canvas drawing
- `src/audio.ts` — generated Web Audio SFX with mute
- `src/leaderboard.ts` — Supabase anon client read/insert
- `src/main.ts` — UI wiring, overlays, `window.__NEON_BARRAGE__` test adapter
- `supabase/migrations/` — reproducible schema + RLS

Public env only: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon/publishable key). The service-role key is never shipped to the browser.

## Database / security

Migration `supabase/migrations/20260807190000_leaderboard.sql` creates `public.leaderboard` with:

- CHECK constraints for name length/charset and plausible non-negative scores
- RLS enabled
- `SELECT` + `INSERT` policies for `anon` / `authenticated`
- no `UPDATE` / `DELETE` grants for public roles

Client-side validation mirrors the DB checks but is not the sole gate.

## Deployment

### Supabase

1. Create a project named with prefix `shootemup-bench-<treatment>-`
2. Apply the SQL migration (Dashboard SQL editor or Management API `/database/query`)
3. Copy the project URL and **anon** key into `.env` / `.env.production`

### Cloudflare Pages

```bash
export CLOUDFLARE_API_TOKEN=...
npm run build
npx wrangler pages project create shootemup-bench-monolith-auto-cursor --production-branch main
npx wrangler pages deploy dist --project-name shootemup-bench-monolith-auto-cursor --commit-dirty=true
```

## Test adapter

```js
window.__NEON_BARRAGE__.getState()
window.__NEON_BARRAGE__.endGameForTest(1234)
```

`endGameForTest` uses the same game-over / score-submit UI as a normal run and does not write to Supabase itself.
