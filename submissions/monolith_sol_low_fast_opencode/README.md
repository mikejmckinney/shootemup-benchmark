# Neon Barrage

A responsive, dependency-light canvas shoot-'em-up with a persistent Supabase leaderboard.

## Local setup

Run `npm install`, then serve `public/` with any static server (for example `npx wrangler pages dev public`). Run `npm test` and `npm run check` for verification.

## Controls

- Move with Arrow keys or WASD.
- Fire with Space.
- On narrow screens use the on-screen direction and fire controls.
- Sound starts only after interaction and can be muted from the header.

## Architecture

`public/game.js` contains a requestAnimationFrame canvas loop, entity updates, collision handling, Web Audio effects, input, and the leaderboard REST client. Pure gameplay helpers are isolated in `public/logic.js` and covered by Node tests. The static frontend is deployed on Cloudflare Pages. Supabase PostgREST provides durable score storage.

## Security

The browser contains only a Supabase publishable key. `public.scores` has RLS enabled with anonymous access restricted to select and insert. SQL constraints independently enforce trimmed 1-16 character alphanumeric callsigns (plus spaces, `_`, `-`) and integer scores from 0 through 10,000,000. Anonymous update and delete are revoked. Reproduce this setup with `supabase/migrations/001_leaderboard.sql`.

## Deployment

Apply the migration to a Supabase project, update the public URL/key constants, then set `CLOUDFLARE_API_TOKEN` and run `npm run deploy -- --project-name shootemup-bench-monolith-sol-low-fast-opencode-neon`.
