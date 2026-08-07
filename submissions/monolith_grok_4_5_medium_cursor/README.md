# Neon Barrage

Browser arcade shoot-'em-up with a Supabase-backed leaderboard, deployed to Cloudflare Pages.

## Local setup

```bash
npm install
cp .env.example .env   # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Scripts:

- `npm run dev` — local Vite server
- `npm run build` — typecheck + production build
- `npm run test` — vitest gameplay/validation tests
- `npm run typecheck` / `npm run lint` — TypeScript checks

## Controls

- **Move:** Arrow keys or WASD
- **Fire:** Space
- **Touch:** on-screen d-pad + FIRE (shown on narrow viewports)
- **Mute:** Sound On / Muted button (Web Audio starts only after user interaction)

## Architecture

- `src/game.ts` — canvas game loop, entities, collisions, difficulty ramp, test adapter state
- `src/audio.ts` — generated Web Audio SFX with mute
- `src/leaderboard.ts` — anon Supabase client, name/score validation, fetch/submit
- `src/main.ts` — UI wiring, overlays, touch controls, `window.__NEON_BARRAGE__`
- `supabase/migrations/001_leaderboard.sql` — table, checks, RLS policies

## Deployment

1. Apply `supabase/migrations/001_leaderboard.sql` to the Supabase project.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon/public only).
3. Build and publish:

```bash
npm run build
export CLOUDFLARE_API_TOKEN=...
npx wrangler pages deploy dist --project-name shootemup-bench-monolith-grok-4-5-medium-cursor-web
```

## Security decisions

- Only the Supabase **anon** key is embedded in the browser bundle; no service-role key.
- RLS is enabled on `public.leaderboard`.
- Policies allow `SELECT` and `INSERT` for `anon`/`authenticated` only.
- Database constraints and insert `WITH CHECK` validate name length/charset and plausible non-negative integer scores.
- Updates/deletes are revoked for public roles.
- Client validation mirrors DB rules for UX; the DB remains the authority.

## Test adapter

Production exposes:

```js
window.__NEON_BARRAGE__.getState()
window.__NEON_BARRAGE__.endGameForTest(score)
```

`endGameForTest` uses the same game-over UI and submit path as normal play; it does not write to Supabase directly.
