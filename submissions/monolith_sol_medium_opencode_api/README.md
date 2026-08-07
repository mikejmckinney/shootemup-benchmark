# Neon Barrage

Neon Barrage is a responsive canvas shoot-'em-up with a persistent, RLS-protected Supabase leaderboard. The production site is hosted on Cloudflare Pages.

## Local Setup

Requires Node.js 20 or newer.

```bash
npm install
VITE_SUPABASE_URL=https://PROJECT.supabase.co \
VITE_SUPABASE_ANON_KEY=sb_publishable_... npm run dev
```

Use only a Supabase publishable or legacy anon key in the frontend environment. Run `npm run check` for unit tests, typechecking, and the production build.

## Controls

- Move with Arrow keys or WASD.
- Fire with Space.
- On narrow screens, use the directional pad and FIRE control beneath the canvas.
- Sound starts only after interaction and can be toggled with `SOUND: ON/OFF`.

## Architecture

The application is dependency-light TypeScript rendered by Vite. `src/main.ts` owns the animation loop, input, collisions, generated Web Audio, game phases, rendering, and Supabase REST calls. `src/rules.ts` holds independently tested gameplay and validation rules. The UI remains playable when the leaderboard is unavailable.

The game runs in a fixed 720x760 coordinate system and scales responsively through CSS. The production test adapter is intentionally narrow: it exposes state and transitions through the normal game-over UI without direct data access.

## Database And Security

Apply `supabase/migrations/001_leaderboard.sql` to a new Supabase project. It creates the table, database constraints, ranking index, and RLS policies. Anonymous clients can only read `name`, `score`, and `created_at`, and insert `name` and `score`. Names are constrained to 1-16 safe characters and scores to integers from 0 through 10,000,000 at the database layer. No secret or service-role credential is used by or bundled into the browser.

## Deployment

```bash
VITE_SUPABASE_URL=https://PROJECT.supabase.co \
VITE_SUPABASE_ANON_KEY=sb_publishable_... npm run build
CLOUDFLARE_API_TOKEN=... npx wrangler pages deploy dist --project-name PROJECT
```

Cloudflare Pages serves the static build. Supabase provides persistence through its generated REST API.
