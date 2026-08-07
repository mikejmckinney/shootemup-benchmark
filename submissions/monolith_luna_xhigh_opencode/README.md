# Neon Barrage

Neon Barrage is a dependency-light browser shoot-'em-up built around a single HTML canvas and a public Supabase leaderboard. The game is designed for desktop keyboard play and narrow touch screens.

## Local Setup

1. Copy the Supabase project URL and anon (publishable) key into `config.js`.
2. Serve this directory with a static server, for example `npx serve .` or `python3 -m http.server 4173`.
3. Open the server URL. Opening `index.html` directly can block module requests in some browsers.

The production config contains only the Supabase anon key. Never put a service-role key in a browser bundle.

## Controls

- Move with WASD or Arrow keys.
- Hold Space to fire.
- On mobile, use the on-canvas directional pad and FIRE button.
- Audio starts only after the user presses a control. The AUDIO button mutes generated Web Audio effects.

## Architecture

- `index.html` and `styles.css` provide the responsive HUD, overlays, leaderboard, and visual system.
- `game.js` owns the requestAnimationFrame loop, canvas rendering, input, collisions, particles, sound, and Supabase REST calls.
- `game-logic.mjs` contains testable validation and gameplay primitives shared by the game and Node tests.
- `migration.sql` creates the constrained leaderboard table and its RLS policies.
- `config.js` is a small deployment-time public configuration file.

## Database and Security

The only exposed table is `public.scores`. RLS is enabled, and public clients can only select rows or insert rows that satisfy the database constraints and policy checks. There are no update/delete policies. Names are limited to 1-16 safe characters and scores to a non-negative signed integer in both SQL and client validation. The leaderboard query requests only the top 10 public fields.

## Tests and Deployment

Run `npm test` for gameplay/data tests and `npm run check` for JavaScript syntax checks. The static site is deployed to Cloudflare Pages. Apply `migration.sql` to the newly created Supabase project using the management API or SQL editor, replace the placeholders in `config.js`, and deploy with Wrangler:

```sh
npx wrangler pages project create <project-name>
npx wrangler pages deploy . --project-name <project-name> --branch main
```

After deployment, verify the production URL returns HTTP 200, submit a score through the game UI, reload, and confirm it appears in the top-10 feed.
