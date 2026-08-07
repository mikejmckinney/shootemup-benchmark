# Neon Barrage

Neon Barrage is a responsive real-time canvas shoot-'em-up with a persistent global leaderboard.

## Local setup

```bash
npm install
npm run dev
```

Production checks:

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
```

## Controls

- Move with `WASD` or the Arrow keys.
- Hold `Space` to fire.
- On narrow/touch layouts, use the directional pad and `FIRE` button below the arena.
- Use the visible sound control in the header to mute generated Web Audio. Audio is initialized only after a user gesture.

## Architecture

The dependency-light Vite/TypeScript frontend renders all gameplay in a single canvas at a fixed logical resolution and scales it responsively. `src/main.ts` owns the real-time loop, entities, controls, generated audio, game states, and leaderboard UI. `src/gameModel.ts` contains deterministic collision, difficulty, and score-normalization behavior covered by Vitest.

Leaderboard reads and writes use Supabase PostgREST directly with the project's browser-safe publishable key. A failure to load or submit scores is contained in the leaderboard UI and never blocks gameplay. The schema is reproducible from `supabase/migrations/20260807015500_create_scores.sql`.

## Security

- No database password, service-role key, or Supabase secret key is shipped to the browser.
- Row Level Security is enabled on the exposed `public.scores` table.
- Public roles receive only `SELECT` and column-scoped `INSERT (name, score)` privileges.
- Database constraints enforce callsign format/length and integer scores from 0 through 10,000,000, independently of browser validation.
- Ranking output is rendered with `textContent`, not untrusted HTML.

## Deployment

Apply the SQL migration to a Supabase project, update the public URL/key in `src/config.ts`, then deploy the static build:

```bash
npm run build
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_KEY" npx wrangler deploy
```

`wrangler.jsonc` defines the asset-only Worker used for this deployment. Cloudflare Pages can alternatively host the same `dist` directory.

The production test adapter is available as `window.__NEON_BARRAGE__`; it transitions through the same game-over and submission UI and does not bypass validation or write data itself.

Set `TEST_URL=https://your-deployment.pages.dev` to run the Chromium smoke tests against a deployment instead of the local Vite server.
