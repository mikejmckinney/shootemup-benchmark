# Neon Barrage

Browser shoot-'em-up with a neon arcade aesthetic, Web Audio SFX, touch controls, and a Supabase-backed persistent leaderboard.

## Local setup

```bash
npm install
cp .env.example .env   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Useful scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Vitest unit tests |
| `npm run typecheck` / `npm run lint` | TypeScript no-emit checks |

## Controls

- **Move:** Arrow keys or WASD
- **Fire:** Space
- **Touch:** on-screen d-pad + FIRE (shown on narrow viewports)
- **Mute:** SOUND ON/OFF control in the HUD (audio starts only after a user gesture)

## Architecture

- `src/main.ts` — UI shell, input wiring, leaderboard form states, `window.__NEON_BARRAGE__` test adapter
- `src/game/engine.ts` — canvas game loop: movement, spawning, collisions, difficulty ramp, particles
- `src/audio.ts` — generated Web Audio tones (gated behind unlock)
- `src/leaderboard.ts` — Supabase anon client + client-side validation helpers
- `supabase/migrations/` — reproducible schema, constraints, and RLS policies

The production test adapter exposes:

```js
window.__NEON_BARRAGE__ = {
  getState: () => ({ phase, score, lives, playerX, playerY, enemyCount, projectileCount }),
  endGameForTest: (score) => { /* normal game-over UI path */ }
};
```

`endGameForTest` only transitions game state; score submission still goes through the same form + DB validation.

## Deployment

### Supabase

1. Create a project whose name begins with `shootemup-bench-<treatment>-`
2. Apply `supabase/migrations/20260807180000_leaderboard.sql`
3. Copy the project URL and **anon/public** key into `.env` / Pages build env vars

### Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist \
  --project-name shootemup-bench-monolith-grok-4-5-medium-fast-cursor-web \
  --commit-dirty=true
```

Cloudflare Pages project names cannot contain underscores, so the treatment slug uses hyphens while remaining uniquely prefixed for this treatment.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time (or rely on the committed public anon defaults for this benchmark treatment).

## Security decisions

- Only the Supabase **anon** key is shipped to the browser; no service-role/secret keys.
- RLS is enabled on `public.leaderboard`.
- Policies allow `SELECT` and `INSERT` for `anon`/`authenticated` only — no update/delete.
- Database constraints enforce:
  - name length 1–16
  - charset `^[A-Za-z0-9 _.-]+$`
  - score integer range `0..10000000`
- Insert policy repeats those checks in `WITH CHECK` so validation is not JS-only.

## Stable test selectors

`game-canvas`, `start-button`, `score`, `lives`, `mute-button`, `leaderboard`, `player-name`, `submit-score`, `touch-controls` — all exposed via `data-testid`.
