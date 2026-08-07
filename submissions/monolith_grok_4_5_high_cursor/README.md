# Neon Barrage

Browser shoot-'em-up with a persistent Supabase leaderboard, deployed to Cloudflare Pages.

## Local setup

```bash
npm install
cp .env.example .env   # already filled for this treatment's project
npm run dev
```

Open the printed local URL. Sound starts only after you press **Start** or **Mute**.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` / `npm run lint` | TypeScript checks |
| `npm test` | Vitest gameplay/validation tests |
| `npm run preview` | Preview production build |

## Controls

- **Move:** Arrow keys or WASD
- **Fire:** Space
- **Touch:** on-screen pad + FIRE (shown on narrow viewports)
- **Mute:** SOUND ON/OFF toggle

## Architecture

- `src/game.ts` — canvas game loop, entities, collisions, difficulty ramp, test hooks
- `src/main.ts` — UI wiring, HUD, touch/keyboard input, leaderboard form, `window.__NEON_BARRAGE__`
- `src/leaderboard.ts` — Supabase anon client (select top 10 / insert score)
- `src/validation.ts` — client-side name/score checks mirrored in SQL constraints
- `src/audio.ts` — Web Audio beeps after user gesture
- `supabase/migrations/` — schema, indexes, RLS policies

Test adapter (production):

```js
window.__NEON_BARRAGE__.getState()
window.__NEON_BARRAGE__.endGameForTest(score)
```

`endGameForTest` only drives the normal game-over UI; inserts still go through the form and DB validation.

## Deployment

### Supabase

1. Project name prefix: `shootemup-bench-monolith_grok_4_5_high_cursor-`
2. Apply `supabase/migrations/20260807183100_leaderboard.sql`
3. Expose only the anon/public key to the frontend via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Cloudflare Pages

```bash
export CLOUDFLARE_API_TOKEN=...
npm run build
npx wrangler pages project create shootemup-bench-monolith-grok-4-5-high-cursor-web --production-branch main
npx wrangler pages deploy dist --project-name shootemup-bench-monolith-grok-4-5-high-cursor-web
```

> Cloudflare Pages names cannot include underscores, so the treatment slug uses hyphens while still matching the `shootemup-bench-<treatment>-` prefix pattern.

## Security decisions

- Browser receives **only** the Supabase anon key; service-role key never ships to the client
- RLS enabled on `public.leaderboard`
- Policies allow `SELECT` and `INSERT` for `anon`/`authenticated` only — no update/delete
- DB constraints enforce name length/charset and non-negative plausible integer scores
- Client validation is UX-only; rejection still happens in Postgres if bypassed
