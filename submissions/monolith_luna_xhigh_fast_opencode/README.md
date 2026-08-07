# Neon Barrage

Neon Barrage is a responsive, canvas-based arcade shooter. Pilot the last signal over a dark city grid, clear escalating waves, and submit your score to the persistent public flight log.

## Local setup

The app is dependency-free and needs Node 20+ only for the checks and static build. Configure the public Supabase values in `config.js`:

```js
window.__SUPABASE_CONFIG__ = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_PUBLIC_ANON_KEY"
};
```

Run `npm test`, `npm run check`, and `npm run build`. Serve the repository root with any static server, for example `npx serve .`, then open `index.html` through that server. Opening from `file://` can block ES modules.

## Controls

- Move with Arrow keys or WASD.
- Hold Space to fire.
- Hold Shift for precision movement.
- On narrow screens, use the on-screen directional pad and FIRE control.
- Sound is generated with Web Audio after a user action. The top-right mute control turns it off.

## Architecture

`src/app.js` owns the requestAnimationFrame loop, canvas rendering, input, collision detection, HUD, audio feedback, and Supabase REST calls. `src/game-logic.js` contains small pure validation and difficulty helpers tested by Node's built-in test runner. `supabase/migrations/001_leaderboard.sql` is the complete remote schema and policy definition. The static build copies the app to `dist/` for Pages deployment.

The production test adapter is `window.__NEON_BARRAGE__`. Its `endGameForTest` method goes through the same game-over and score form as normal play; it does not submit scores or bypass validation.

## Database and security

The browser contains only the Supabase project URL and public anon key. No service-role key is used. The migration enables RLS, grants public select and insert only, and applies the same call-sign and integer-score constraints in PostgreSQL. There are no public update or delete policies.

## Deployment

1. Create a new Supabase project and apply `supabase/migrations/001_leaderboard.sql` in its SQL editor (or with the Supabase CLI).
2. Put its URL and public anon key in `config.js`.
3. Run `npm run build`.
4. Create a Cloudflare Pages project and deploy `dist/` with Wrangler: `npx wrangler pages project create PROJECT_NAME` followed by `npx wrangler pages deploy dist --project-name PROJECT_NAME`.

The deployed URL, project reference, and public key are recorded in `benchmark-result.json` after live verification.
