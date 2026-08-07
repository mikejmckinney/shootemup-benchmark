# Neon Barrage

Neon Barrage is a dependency-light, responsive canvas shoot-'em-up. It is plain browser JavaScript so the same `site/` directory can be served from Cloudflare Pages, a static host, or a local web server.

## Local setup

```bash
npm test
npm run build
npm run dev
```

Open `http://localhost:4173`. The game works without Supabase configuration; the leaderboard displays an offline-safe empty state and the arcade remains playable.

For a live leaderboard, inject the browser-safe project URL and anon/public key before `src/main.js` loads:

```html
<script>
  window.__NEON_BARRAGE_CONFIG__ = {
    supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
    supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY"
  };
</script>
```

The coordinator’s root build may instead inject `window.NEON_BARRAGE_CONFIG` through `config.js`; both shapes are supported. Apply [`supabase/migrations/001_leaderboard.sql`](./supabase/migrations/001_leaderboard.sql) to a standalone project, or use the coordinator-owned root migration when integrating the shared deployment. Do not put an administrative database credential in either object or in any frontend file.

## Controls and architecture

- Arrow keys or WASD move the interceptor; Space fires.
- On narrow viewports, the d-pad and FIRE button provide pointer/touch controls.
- Sound is generated with Web Audio only after a start, fire, touch, or mute interaction. The header control toggles it.
- `src/game-logic.js` contains deterministic state updates and collision rules; `src/game.js` owns the canvas loop and presentation effects.
- `src/leaderboard.js` validates names and integer scores, then uses the Supabase REST endpoint for `public.leaderboard` with only the runtime public key. Loading, empty, validation, and network-error states are rendered by `src/main.js`.

The production test adapter is intentionally narrow:

```js
window.__NEON_BARRAGE__.getState();
window.__NEON_BARRAGE__.endGameForTest(1200);
```

The adapter calls the same game-over UI as a normal run and never submits a score itself.

## Deployment

Run `npm run build` and deploy `dist/` as the static asset directory. Configure the runtime `window.__NEON_BARRAGE_CONFIG__` object from the deployment environment/template. The included SQL enables RLS and grants the public anon role only the leaderboard `select` and `insert (player_name, score)` operations; the database constraints repeat the 1–16 character name and signed 32-bit integer score validation enforced in the browser.
