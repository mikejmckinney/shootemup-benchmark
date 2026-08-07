# Neon Barrage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, deploy, and verify a responsive Neon Barrage canvas shooter with a public, RLS-protected Supabase leaderboard.

**Architecture:** A Vite vanilla TypeScript frontend keeps the deterministic game simulation in `src/game-engine.ts`, browser presentation and input in `src/main.ts`, and Supabase access plus validation in `src/leaderboard.ts`. A single SQL migration defines the public leaderboard table and policies; Cloudflare Pages serves the Vite output.

**Tech Stack:** TypeScript, Vite, Vitest, `@supabase/supabase-js`, Web Audio API, Cloudflare Pages, Supabase PostgreSQL/RLS.

## Global Constraints

- The deployed game must render a real-time 2D arcade shooter in a canvas.
- Keyboard controls are Arrow keys or WASD for movement and Space for firing.
- Narrow/mobile viewports must have touch controls.
- Gameplay includes enemies, projectiles, collision detection, score, lives, escalating difficulty, game over, and restart.
- Sound must have a visible mute control and begin only after user interaction.
- Leaderboard names are 1-16 characters; final scores persist in Supabase and the UI shows the top 10 in descending order.
- Loading, empty, validation, and network-error states cannot make the game unplayable.
- The browser may contain only the Supabase URL and anon/public key, never a service-role key.
- Every exposed table has RLS; public operations are limited to leaderboard select and insert.
- Database constraints validate names and plausible non-negative integer scores.
- Required selectors are exactly the `data-testid` values in `BENCHMARK_TASK.md`.
- Production must expose `window.__NEON_BARRAGE__` with `getState` and validated `endGameForTest`.
- Resource names begin with `shootemup-bench-dynamic-luna-max-opencode-superpowers-`.
- The final result JSON contains only public Supabase data and verified deployment metadata.

---

## Task 1: Scaffold The Static TypeScript App

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/vite-env.d.ts`
- Generated: `package-lock.json`

**Interfaces:**
- Produces npm scripts `dev`, `build`, `typecheck`, and `test` for all later tasks.
- Produces Vite environment typing for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 1: Add pinned project metadata and scripts**

Create `package.json` with this shape and the listed pinned versions:

```json
{
  "name": "neon-barrage",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.53.0"
  },
  "devDependencies": {
    "@types/node": "22.15.21",
    "typescript": "5.8.3",
    "vite": "6.3.5",
    "vitest": "3.1.2",
    "wrangler": "4.15.2"
  }
}
```

- [ ] **Step 2: Install the pinned dependencies and generate the lockfile**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and `node_modules` installs without changing dependency ranges.

- [ ] **Step 3: Add TypeScript, Vite, and environment configuration**

Use strict TypeScript settings and no output files:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Declare `ImportMetaEnv` in `src/vite-env.d.ts` with both Vite Supabase variables as optional strings, and configure `vite.config.ts` with `defineConfig({})`.

- [ ] **Step 4: Add the HTML entry point and ignored local files**

Create a minimal `index.html` with `<div id="app"></div>`, a descriptive title, viewport metadata, and `<script type="module" src="/src/main.ts"></script>`. Ignore `node_modules`, `dist`, `.env`, `.env.*`, and `.wrangler` while allowing `.env.example`.

- [ ] **Step 5: Run the scaffold checks**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands pass and Vite writes `dist/index.html`.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/vite-env.d.ts .gitignore
git commit -m "chore: scaffold Neon Barrage frontend"
```

## Task 2: Build The Testable Game Engine With TDD

**Files:**
- Create: `tests/game-engine.test.ts`
- Create: `src/game-engine.ts`

**Interfaces:**
- `Phase = 'idle' | 'running' | 'game-over'`.
- `GameState = { phase: Phase; score: number; lives: number; playerX: number; playerY: number; enemyCount: number; projectileCount: number }`.
- `InputState = { left: boolean; right: boolean; up: boolean; down: boolean; firing: boolean }`.
- `GameEngineOptions = { width?: number; height?: number; random?: () => number }`.
- `GameEngine` exposes `getState()`, `start()`, `reset()`, `setInput(input: Partial<InputState>)`, `update(deltaMs: number)`, `fire()`, `spawnEnemyForTest(x: number, y: number)`, `getSpawnIntervalForTest(score?: number)`, `endForTest(score: number)`, and `consumeEvents()`.
- `GameEvent` is `{ type: 'fire' | 'hit' | 'damage' | 'game-over' }`.

- [ ] **Step 1: Write failing engine behavior tests**

Create tests covering the state machine, bounded movement, projectile lifecycle, collision scoring, life loss/game over, difficulty, and test transition:

```ts
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game-engine';

describe('GameEngine', () => {
  it('starts with an idle player and three lives', () => {
    const state = new GameEngine().getState();
    expect(state).toMatchObject({ phase: 'idle', score: 0, lives: 3, enemyCount: 0, projectileCount: 0 });
  });

  it('moves within the logical playfield', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    engine.setInput({ left: true, up: true });
    engine.update(10_000);
    expect(engine.getState().playerX).toBeGreaterThanOrEqual(28);
    expect(engine.getState().playerY).toBeGreaterThanOrEqual(28);
  });

  it('fires and removes projectiles after leaving the field', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    expect(engine.fire()).toBe(true);
    expect(engine.getState().projectileCount).toBe(1);
    engine.update(3_000);
    expect(engine.getState().projectileCount).toBe(0);
  });

  it('scores a hit and emits a hit event', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    engine.spawnEnemyForTest(480, 500);
    expect(engine.fire()).toBe(true);
    engine.update(300);
    expect(engine.getState().score).toBeGreaterThan(0);
    expect(engine.consumeEvents().some((event) => event.type === 'hit')).toBe(true);
  });

  it('ends after the third damage event', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    engine.spawnEnemyForTest(engine.getState().playerX, engine.getState().playerY);
    engine.update(1);
    engine.spawnEnemyForTest(engine.getState().playerX, engine.getState().playerY);
    engine.update(1);
    engine.spawnEnemyForTest(engine.getState().playerX, engine.getState().playerY);
    engine.update(1);
    expect(engine.getState().phase).toBe('game-over');
    expect(engine.getState().lives).toBe(0);
  });

  it('accelerates spawn pacing as the score rises', () => {
    const engine = new GameEngine({ width: 960, height: 600, random: () => 0.5 });
    const initial = engine.getSpawnIntervalForTest(0);
    expect(engine.getSpawnIntervalForTest(5_000)).toBeLessThan(initial);
  });

  it('uses the normal game-over state for a valid test score', () => {
    const engine = new GameEngine();
    engine.endForTest(1234);
    expect(engine.getState()).toMatchObject({ phase: 'game-over', score: 1234, lives: 0 });
    expect(() => engine.endForTest(-1)).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
npm test -- tests/game-engine.test.ts
```

Expected: FAIL because `src/game-engine.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal deterministic simulation**

Implement `GameEngine` with a 960x600 default field, player bounds of 28 pixels from each edge, a 3-life reset, a 1,000 ms initial spawn interval, 440 px/s projectiles, 75 px/s minimum enemy speed, and collision radii that make visible sprites feel responsive. Use the injected random function for spawn x/variant selection. `update` must no-op unless running, clamp `deltaMs` to 100 ms, move input at 320 px/s, spawn according to the current interval, remove off-field entities, award 100 points per hit, reduce lives once per enemy contact, and emit `game-over` exactly once. `endForTest` must throw for non-integer or negative scores and otherwise set the same game-over state used by ordinary play.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run:

```bash
npm test -- tests/game-engine.test.ts
```

Expected: all engine tests pass.

- [ ] **Step 5: Run type checking**

Run `npm run typecheck` and fix every strict TypeScript error before continuing.

- [ ] **Step 6: Commit the engine**

```bash
git add src/game-engine.ts tests/game-engine.test.ts
git commit -m "feat: add deterministic Neon Barrage engine"
```

## Task 3: Add The Canvas Presentation, Controls, Audio, And Test Adapter

**Files:**
- Modify: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`

**Interfaces:**
- `main.ts` consumes the `GameEngine` API from Task 2.
- The page includes `[data-testid="game-canvas"]`, `[data-testid="start-button"]`, `[data-testid="score"]`, `[data-testid="lives"]`, `[data-testid="mute-button"]`, and `[data-testid="touch-controls"]`.
- The global adapter is `window.__NEON_BARRAGE__ = { getState, endGameForTest }` and `getState` returns exactly the seven documented state keys.

- [ ] **Step 1: Add the stable application markup**

Build the app shell in `index.html` with a header, game panel, canvas, HUD values, start button, mute button, status/live region, game-over form container, touch controls, and leaderboard container. Use this minimum control structure:

```html
<canvas data-testid="game-canvas" width="960" height="600" aria-label="Neon Barrage game"></canvas>
<button data-testid="start-button" type="button">Launch Mission</button>
<button data-testid="mute-button" type="button" aria-pressed="false">Sound On</button>
<output data-testid="score">0</output>
<output data-testid="lives">3</output>
<div data-testid="touch-controls" aria-label="Touch controls"></div>
```

- [ ] **Step 2: Add failing browser-facing test adapter assumptions to the implementation checklist**

Keep the adapter implementation testable without exposing internal engine methods: `getState()` maps the engine state to a new object, and `endGameForTest(score)` calls `engine.endForTest(score)` followed by the same game-over render path used by ordinary play.

- [ ] **Step 3: Implement the animation loop and renderer**

Create the `GameEngine`, obtain the 2D context, and run `requestAnimationFrame`. Draw a multi-layer starfield, cyan player ship, magenta enemy variants, bright projectiles, and short-lived hit rings. Resize the CSS canvas without changing its logical dimensions. Update score/lives output every frame and show a status message for launch, active wave, and game over.

- [ ] **Step 4: Implement keyboard and touch input**

Map ArrowLeft/Right/Up/Down and `KeyW/A/S/D` to the engine input. Prevent page scrolling for handled keys. Map Space to `engine.fire()` with key-repeat suppression. Add pointerdown/pointerup/pointercancel handlers for four directional buttons and fire; set input false on every release/cancel. Only show the touch pad prominently under 760px while keeping it accessible at all widths.

- [ ] **Step 5: Implement user-gesture-gated generated sound**

Create an `AudioContext` only inside start, fire, mute, or touch handlers. Generate short oscillator tones for firing, hits, damage, and game over. Keep a `muted` boolean, update `aria-pressed`, and never call `AudioContext` APIs during module initialization or a passive animation frame.

- [ ] **Step 6: Add responsive neon presentation styles**

Use CSS custom properties for deep navy surfaces, cyan primary accents, magenta enemy accents, and readable muted text. Give the game panel a restrained glow, preserve canvas aspect ratio with `width: 100%`, use a two-column desktop layout and stacked mobile layout, and ensure buttons and touch targets are at least 44px high.

- [ ] **Step 7: Verify the presentation build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands pass with all required selectors in the generated bundle.

- [ ] **Step 8: Commit the browser game**

```bash
git add index.html src/main.ts src/styles.css
git commit -m "feat: add Neon Barrage canvas gameplay UI"
```

## Task 4: Add The Supabase Leaderboard And Database Migration

**Files:**
- Create: `src/leaderboard.ts`
- Create: `tests/leaderboard.test.ts`
- Create: `supabase/migrations/20260806000000_create_leaderboard.sql`
- Modify: `src/main.ts`

**Interfaces:**
- `LeaderboardEntry = { player_name: string; score: number; created_at: string }`.
- `validatePlayerName(name: string): { ok: true; value: string } | { ok: false; message: string }`.
- `createLeaderboardService(url: string | undefined, anonKey: string | undefined): LeaderboardService`.
- `LeaderboardService.loadTop(): Promise<Result<LeaderboardEntry[]>>`.
- `LeaderboardService.submit(name: string, score: number): Promise<Result<LeaderboardEntry>>`.
- `Result<T> = { ok: true; value: T } | { ok: false; message: string }`.

- [ ] **Step 1: Write failing validation tests**

Add tests for trimming, the 1-16 character boundary, blank names, control characters, and plausible integer scores:

```ts
import { describe, expect, it } from 'vitest';
import { validatePlayerName, validateScore } from '../src/leaderboard';

describe('leaderboard validation', () => {
  it('trims and accepts a 1-16 character name', () => {
    expect(validatePlayerName('  NOVA-7  ')).toEqual({ ok: true, value: 'NOVA-7' });
    expect(validatePlayerName('1234567890123456').ok).toBe(true);
  });

  it('rejects blank, overlong, and control-character names', () => {
    expect(validatePlayerName('   ').ok).toBe(false);
    expect(validatePlayerName('12345678901234567').ok).toBe(false);
    expect(validatePlayerName('pilot\nname').ok).toBe(false);
  });

  it('accepts only bounded non-negative integer scores', () => {
    expect(validateScore(0).ok).toBe(true);
    expect(validateScore(2_000_000_001).ok).toBe(false);
    expect(validateScore(2.5).ok).toBe(false);
    expect(validateScore(-1).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the validation tests to verify they fail**

Run `npm test -- tests/leaderboard.test.ts` and expect a missing-module failure.

- [ ] **Step 3: Implement the Supabase service and validation**

Use `createClient` from `@supabase/supabase-js` only when both public configuration values exist. Query `leaderboard_entries` with `select('player_name,score,created_at').order('score', { ascending: false }).order('created_at', { ascending: true }).limit(10)`. Insert only `{ player_name: trimmedName, score }`, request the inserted row, and convert Supabase errors into user-safe messages. Return a configuration error rather than throwing when local public config is absent.

- [ ] **Step 4: Run the validation tests and typecheck**

Run:

```bash
npm test -- tests/leaderboard.test.ts
npm run typecheck
```

Expected: validation tests pass and the service compiles with strict types.

- [ ] **Step 5: Add the RLS migration**

Create the table and policies with this exact security shape:

```sql
create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint leaderboard_name_length check (char_length(player_name) between 1 and 16),
  constraint leaderboard_name_trimmed check (char_length(btrim(player_name)) between 1 and 16),
  constraint leaderboard_name_no_control check (player_name !~ '[\r\n\t]'),
  constraint leaderboard_score_plausible check (score between 0 and 2000000000)
);

alter table public.leaderboard_entries enable row level security;
grant usage on schema public to anon;
grant select, insert on table public.leaderboard_entries to anon;

create policy "public can read leaderboard"
  on public.leaderboard_entries for select to anon using (true);

create policy "public can submit bounded scores"
  on public.leaderboard_entries for insert to anon
  with check (
    char_length(player_name) between 1 and 16
    and char_length(btrim(player_name)) between 1 and 16
    and player_name !~ '[\r\n\t]'
    and score between 0 and 2000000000
  );
```

Do not add update/delete grants or policies. Add a unique policy/table comment only if it does not change the permitted operations.

- [ ] **Step 6: Wire loading, submit, empty, and error UI into `main.ts`**

Load top entries on page initialization without gating the animation loop. Render rank, escaped text, score, and a readable empty state. On game over, reveal `[data-testid="player-name"]` and `[data-testid="submit-score"]`, validate before calling the service, disable while pending, report errors in a status element, and refresh after success. Keep the score visible if the request fails. Use `textContent`, not `innerHTML`, for player-provided names.

- [ ] **Step 7: Run all local tests and build**

Run:

```bash
npm test
npm run build
```

Expected: all engine and leaderboard tests pass and `dist` builds successfully.

- [ ] **Step 8: Commit the leaderboard feature**

```bash
git add src/leaderboard.ts src/main.ts tests/leaderboard.test.ts supabase/migrations/20260806000000_create_leaderboard.sql
git commit -m "feat: add secure persistent leaderboard"
```

## Task 5: Finish Documentation And Local Configuration Evidence

**Files:**
- Create: `README.md`
- Create: `.env.example`

**Interfaces:**
- `.env.example` documents only variable names, never live values.
- `README.md` documents commands and security decisions used by later deployment verification.

- [ ] **Step 1: Add the public environment template**

Create:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

- [ ] **Step 2: Write the setup and deployment README**

Document Node/npm prerequisites, `npm install`, `.env.local`, `npm run dev`, controls, touch controls, the engine/UI/service architecture, migration application, RLS and anon-key security, `npm test`, `npm run typecheck`, `npm run build`, Cloudflare Pages deployment, and the production test adapter. State explicitly that `SUPABASE_API_KEY` and `CLOUDFLARE_API_KEY` are management credentials and must never be placed in Vite variables or committed.

- [ ] **Step 3: Run documentation and repository hygiene checks**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
```

Expected: no whitespace errors and all checks pass.

- [ ] **Step 4: Commit the documentation**

```bash
git add README.md .env.example
git commit -m "docs: document Neon Barrage setup and security"
```

## Task 6: Provision Supabase And Cloudflare Pages

**Files:**
- Runtime artifact: `dist/`
- Runtime metadata: `.env.production.local` (ignored and never committed)

**Interfaces:**
- Supabase project name: `shootemup-bench-dynamic-luna-max-opencode-superpowers-neon-barrage`.
- Cloudflare Pages project name: `shootemup-bench-dynamic-luna-max-opencode-superpowers-neon-barrage`.
- Production build consumes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 1: Check credentials without printing them**

Run shell checks that only report whether `SUPABASE_API_KEY` and `CLOUDFLARE_API_KEY` are non-empty. Never print either value or include either value in a file.

- [ ] **Step 2: Create the Supabase project**

Using the Supabase management API or pinned CLI, create the named project under organization `xfbsknprvxldvgioaows` with a generated database password held only in the shell. Map `SUPABASE_API_KEY` to the CLI/API token variable required by the chosen tool. Record only the project ref, API URL, and anon key returned by the project API.

- [ ] **Step 3: Apply the migration and verify RLS metadata**

Apply `supabase/migrations/20260806000000_create_leaderboard.sql` through the Supabase SQL/migration API. Query the project metadata or PostgREST behavior to confirm the table exists, RLS is enabled, anonymous select and insert work, and update/delete are not granted. Do not use a service key in the browser build.

- [ ] **Step 4: Build with public production configuration**

Use a process-local environment assignment:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
VITE_SUPABASE_ANON_KEY="<anon-key>" \
npm run build
```

Verify the generated source contains the URL and public key only, and search the generated files for neither management credential name nor secret value.

- [ ] **Step 5: Create and deploy the Cloudflare Pages project**

Map `CLOUDFLARE_API_KEY` to `CLOUDFLARE_API_TOKEN` for Wrangler and run the pinned local binary:

```bash
npx wrangler pages project create shootemup-bench-dynamic-luna-max-opencode-superpowers-neon-barrage --production-branch main
npx wrangler pages deploy dist --project-name shootemup-bench-dynamic-luna-max-opencode-superpowers-neon-barrage
```

Capture the assigned `https://...pages.dev` URL without placing a management token in the repository.

## Task 7: Verify Live Behavior And Write The Required Result Artifact

**Files:**
- Create: `benchmark-result.json`

**Interfaces:**
- The JSON has exactly the fields and nested verification fields required by `BENCHMARK_TASK.md`.

- [ ] **Step 1: Verify production HTTP and required selectors**

Request the final Cloudflare URL and assert HTTP 200. Download the HTML/asset response as needed and assert the production artifact references `data-testid="game-canvas"`, `start-button`, `score`, `lives`, `mute-button`, `leaderboard`, `player-name`, `submit-score`, `touch-controls`, and `__NEON_BARRAGE__`.

- [ ] **Step 2: Verify a real Supabase insert/read round trip**

Use the Supabase anon URL/key to insert a unique test name no longer than 16 characters and a non-negative integer score, then query the top ten and assert the inserted row is present. Repeat the production page load after submission to confirm the leaderboard remains readable. Do not delete the row because anonymous delete is intentionally not allowed.

- [ ] **Step 3: Run the final local checks**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all commands pass. Inspect `git status --short` and confirm no `.env*`, credential, or generated secret file is staged.

- [ ] **Step 4: Write the exact result JSON only after live verification**

Write `benchmark-result.json` with this shape, replacing angle-bracket values with verified public values:

```json
{
  "treatment": "dynamic_luna_max_opencode_superpowers",
  "status": "complete",
  "cloudflare_url": "https://<verified-pages-url>",
  "cloudflare_project": "shootemup-bench-dynamic-luna-max-opencode-superpowers-neon-barrage",
  "supabase_url": "https://<verified-project-ref>.supabase.co",
  "supabase_project_ref": "<verified-project-ref>",
  "supabase_public_key": "<verified-anon-key>",
  "verification": {
    "production_http_status": 200,
    "leaderboard_round_trip": true,
    "tests_passed": true
  },
  "notes": "Neon Barrage deployed to Cloudflare Pages; Supabase leaderboard insert/read verified with the public client."
}
```

- [ ] **Step 5: Inspect the final diff and commit the artifact**

Before committing, run `git status --short`, `git diff --stat`, `git diff --check`, and `git log --oneline -10`. Stage only source, tests, migration, docs, lockfile, and `benchmark-result.json`; leave the pre-existing `opencode.json` change untouched. Commit with:

```bash
git add benchmark-result.json
git commit -m "chore: record verified Neon Barrage deployment"
```
