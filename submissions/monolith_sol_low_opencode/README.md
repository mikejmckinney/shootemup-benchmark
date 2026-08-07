# Neon Barrage

Neon Barrage is a responsive canvas shoot-'em-up with a persistent global Supabase leaderboard.

## Local setup

Requires Node.js 20+. Copy the public project URL and anon/publishable key into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLIC_KEY`, then run:

```sh
npm install
npm run dev
```

`npm test` runs gameplay/data validation tests and `npm run build` creates the static site in `dist/`.

## Controls

- Move with WASD or Arrow keys.
- Fire with Space.
- Mobile viewports expose a directional pad and FIRE control.
- Sound starts only after interaction and can be toggled from the HUD.

## Architecture

The game is a dependency-free canvas loop in `src/main.js`; pure collision, difficulty, and validation helpers live in `src/engine.js`. The client uses Supabase PostgREST with a public key to read the top ten and insert completed runs. Failure states remain isolated from gameplay.

## Security

`supabase/migrations/001_leaderboard.sql` enables RLS and grants anonymous users only `SELECT` and `INSERT`. Database constraints independently enforce a 1-16 character safe callsign and an integer score from 0 through 10,000,000. Update and delete are revoked. No service-role key or management credential is shipped to the browser.

## Deployment

Apply the SQL migration to a Supabase project, provide its public URL/key as Vite build environment variables, run `npm run build`, and deploy `dist/` to Cloudflare Pages or Workers static assets.
