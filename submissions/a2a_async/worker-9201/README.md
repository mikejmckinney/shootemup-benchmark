# Neon Barrage frontend handoff

This directory is a self-contained static implementation of the Neon Barrage arcade game. It is intentionally framework-free: the coordinator can copy these files into the candidate root and serve `index.html` from Cloudflare Pages or another static host.

## Local run

```bash
npm test
npm run check
python3 -m http.server 4173
```

Open <http://localhost:4173>. There are no runtime npm dependencies; `package-lock.json` is included to pin that dependency-free project shape.

Controls:

- Arrow keys or `WASD` move the ship.
- Hold `Space` to fire.
- On narrow viewports, press and hold the on-screen movement and `FIRE` controls.
- Sound is opt-in after a user gesture and can be muted from the top-right control.

## Coordinator integration

1. Apply [`supabase/migrations/001_create_leaderboard.sql`](./supabase/migrations/001_create_leaderboard.sql) to the new Supabase project.
2. Copy this directory’s files into the candidate root, preserving the relative `src/` and `supabase/` paths.
3. Replace the small config bootstrap near the bottom of `index.html` with the project’s public values:

   ```html
   <script>
     window.__NEON_BARRAGE_CONFIG__ = {
       supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
       supabaseAnonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
       // Set this only when reusing a coordinator schema with this column name.
       leaderboardNameColumn: "name"
     };
   </script>
   ```

   The key must be the publishable/anon browser key. Never put a service-role key in this file or in a Cloudflare public asset.

4. Deploy the directory as static assets. There is no build step and the deployment output directory is the directory containing `index.html`.
5. Smoke-test the production URL, then call the public REST endpoint or use the UI to verify a leaderboard insert and top-10 read. The final candidate-level `benchmark-result.json` belongs to the coordinator.

The browser uses the Supabase REST API directly, with `select` ordered by score and `created_at`, limited to ten rows, and `insert` for submissions. A missing or unavailable configuration leaves the game playable and renders a clear offline/network state.

The supplied migration uses `leaderboard.name`. If the coordinator keeps an existing compatible table that calls this column `player_name`, set `leaderboardNameColumn: "player_name"` in the config; the client accepts and submits either shape without changing the UI.

## Architecture

- `index.html` — semantic shell, stable evaluator selectors, overlay/form, leaderboard, and touch controls.
- `styles.css` — responsive dark neon art direction, canvas framing, HUD, leaderboard, and mobile layout.
- `app.js` — requestAnimationFrame loop, canvas renderer, keyboard/pointer input, generated Web Audio, DOM state transitions, Supabase REST adapter wiring, and the production test adapter.
- `src/game-engine.js` — deterministic game rules: movement, spawning, projectiles, collisions, lives, score, particles, difficulty, and game-over.
- `src/leaderboard.js` — validated client-side inputs and a dependency-free REST client using only the public Supabase key.
- `tests/*.test.js` — Node built-in tests for gameplay rules, score validation, and request shape.

The production adapter is deliberately narrow:

```js
window.__NEON_BARRAGE__.getState();
window.__NEON_BARRAGE__.endGameForTest(1234);
```

`endGameForTest` validates a non-negative safe integer, transitions the same game state to `gameover`, and opens the same score/name submission UI used by normal gameplay. It does not call Supabase.

Stable selectors are present for the canvas, start, score, lives, mute, leaderboard, player name, score submit, and touch controls as specified in `BENCHMARK_TASK.md`.

## Security decisions

- No Supabase secret or service-role credential is present in source. The coordinator supplies only the publishable/anon key at integration time.
- The migration enables and forces RLS, adds database-level name and plausible-integer score checks, grants only public `select` and `insert`, and defines no update/delete policies.
- Names are validated in both the browser and database. DOM text is inserted with `textContent` so leaderboard values are not interpreted as HTML.
- Score submission errors, missing configuration, empty boards, and loading state are visible without blocking a new game.
