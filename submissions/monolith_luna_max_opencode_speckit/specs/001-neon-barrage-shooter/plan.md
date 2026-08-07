# Implementation Plan: Neon Barrage Browser Shoot-'Em-Up

**Branch**: `001-neon-barrage-shooter` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-neon-barrage-shooter/spec.md`

## Summary

Build a greenfield static single-page game with a React and TypeScript interface,
an isolated deterministic canvas game engine, and a Supabase-backed public
leaderboard. The browser receives only the Supabase URL and public anonymous key.
The schema, constraints, and RLS policies are committed as a migration. The built
static assets are deployed to Cloudflare Pages, then verified through the production
game flow, a real leaderboard insert/read round trip, and the required evidence file.

The implementation order is test-first: define engine and validation contracts,
write failing unit and integration tests, implement the game and UI slices, deploy,
and run the same stable-selector checks against production.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS

**Primary Dependencies**: React 19, React DOM, Vite, `@supabase/supabase-js` v2,
Vitest, React Testing Library, Playwright, ESLint, and TypeScript compiler

**Storage**: One Supabase Postgres table, `public.leaderboard_entries`, with
server-generated identity and timestamp fields; no browser-side secret storage

**Testing**: Vitest for deterministic game and validation logic, React Testing
Library for stateful UI behavior, and Playwright for stable-selector and production
smoke tests

**Target Platform**: Cloudflare Pages static hosting; evergreen desktop and mobile
browsers with canvas, touch, keyboard, and user-gesture audio support

**Project Type**: Single-page web application with a client-side game engine and a
public persistence boundary

**Performance Goals**: Maintain a 60 FPS animation target on a representative
desktop and narrow mobile viewport, show an actionable start state within 3 seconds
on standard broadband, and provide visible input feedback within 100 ms during play

**Constraints**: Maximum 45-minute delivery window; no service-role or management
secret in client assets; anonymous public leaderboard access limited to select and
insert; database validation is authoritative; fixed test selectors and adapter;
resource names begin with `shootemup-bench-<treatment>-`; all source and evidence
remain in the candidate directory

**Scale/Scope**: One anonymous player session per browser, one public top-10
leaderboard view, one new Supabase project, one Cloudflare Pages project, and no
authentication, multiplayer, administration, editing, or deletion UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Gate

- **Correctness Is Observable**: PASS. Each spec requirement maps to a deterministic
  engine test, UI contract, database check, or production smoke check.
- **Test-First Engineering**: PASS. Tests for engine transitions, validation, RLS
  behavior, and the primary UI flow are written before their implementation slices.
- **Security Is a Boundary Contract**: PASS. The migration owns constraints and RLS;
  the browser receives only public configuration; update/delete and administrative
  access are absent from public grants.
- **Accessibility Is a Release Requirement**: PASS. Semantic controls, focus states,
  keyboard and touch input, reduced-motion behavior, and user-gesture audio are part
  of the UI design and test plan.
- **Deployment Must Be Verified**: PASS. Cloudflare production smoke checks and a
  real leaderboard insert/read plus reload are release gates.
- **Evidence Is a Deliverable**: PASS. The plan includes a migration, README,
  lockfile, reproducible commands, contracts, and exact `benchmark-result.json`
  verification fields.
- **Sole-agent and scope constraints**: PASS. Planning and implementation are kept
  in the candidate directory without delegation or inspection of excluded artifacts.

### Post-Design Gate

- **Status**: PASS. The chosen structure has one deployable frontend, one explicitly
  constrained persistence table, and no unreviewed governance exceptions.
- **Open violations**: None.

## Project Structure

### Documentation (this feature)

```text
specs/001-neon-barrage-shooter/
├── plan.md              # This implementation plan
├── research.md          # Phase 0 decisions and alternatives
├── data-model.md        # Client state and Supabase entity design
├── quickstart.md        # Local, database, and production validation guide
├── contracts/
│   ├── leaderboard.md   # Public data operations and ordering contract
│   ├── ui-test-surface.md # Required selectors and test adapter
│   └── release-evidence.md # benchmark-result.json contract
└── tasks.md             # Phase 2 output; not created by this command
```

### Source Code (repository root)

```text
package.json
package-lock.json
index.html
.env.example
vite.config.ts
tsconfig.json
eslint.config.js
playwright.config.ts
src/
├── main.tsx
├── App.tsx
├── styles.css
├── config/
│   └── env.ts
├── game/
│   ├── types.ts
│   ├── config.ts
│   ├── engine.ts
│   ├── collision.ts
│   ├── input.ts
│   ├── render.ts
│   └── audio.ts
├── leaderboard/
│   ├── types.ts
│   ├── validation.ts
│   └── client.ts
├── components/
│   ├── GameCanvas.tsx
│   ├── Hud.tsx
│   ├── StartPanel.tsx
│   ├── GameOverPanel.tsx
│   ├── Leaderboard.tsx
│   ├── TouchControls.tsx
│   └── StatusMessage.tsx
└── test-adapter.ts
tests/
├── unit/
│   ├── engine.test.ts
│   ├── collision.test.ts
│   └── validation.test.ts
├── integration/
│   ├── leaderboard-client.test.ts
│   └── app-flow.test.tsx
└── e2e/
    ├── game-flow.spec.ts
    ├── accessibility.spec.ts
    └── production.spec.ts
supabase/
└── migrations/
    └── 20260806_create_leaderboard_entries.sql
scripts/
└── verify-production.mjs
README.md
benchmark-result.json
```

**Structure Decision**: Use one Vite frontend with domain-separated `game` and
`leaderboard` modules. React owns page and form state; the game engine owns mutable
simulation state and renders to one canvas; Supabase access is isolated in one
client module. Tests mirror those boundaries. The migration and verification script
are first-class repository artifacts rather than deployment-only commands.

## Implementation Sequence

1. **Foundation and contracts**: initialize the package, TypeScript/Vite scripts,
   environment validation, CSS reset, test configuration, and the required contract
   documents. Add the failing tests for the test adapter shape and stable selectors.
2. **Pure game engine**: implement typed session state, deterministic seeded random
   input, fixed-step updates, movement bounds, projectile/enemy lifecycle, collision
   resolution, score/lives, difficulty progression, game-over, and restart. Keep
   `step(state, input, delta, random)` pure so unit tests do not require a browser.
3. **Canvas and controls**: connect the engine to `requestAnimationFrame` with a
   bounded delta, render at device-pixel-ratio-aware dimensions, add keyboard and
   pointer/touch input, and prevent browser scrolling only while gameplay controls
   are active. Add audio creation lazily after the first user gesture and honor mute
   and reduced-motion preferences.
4. **Accessible UI state**: add semantic Start, Restart, Mute, name, Submit, Retry,
   and status controls around the canvas. Expose score/lives as text, preserve
   visible focus, provide accessible names, and keep game flow usable when audio or
   network access fails.
5. **Leaderboard boundary**: add the migration, constraints, grants, RLS policies,
   typed client, client validation, loading/empty/error/retry states, deterministic
   top-10 ordering, and the production test adapter path. The adapter transitions the
   same game-over UI and never calls the data client directly.
6. **Test and quality gates**: run unit, UI, accessibility, build, lint, and type
   checks. Run browser tests against a local production build, inspect bundles for
   protected credentials, and apply the migration to the new Supabase project.
7. **Deploy and verify**: create the treatment-prefixed Cloudflare Pages and
   Supabase resources, publish the static build, run the production smoke and real
   insert/read/reload check, record factual values in `benchmark-result.json`, and
   do not report complete until all gates pass.

## Complexity Tracking

No constitution violations require a complexity exception. The single frontend,
single persistence table, and isolated pure engine are the simplest structures that
meet the required gameplay, security, testability, and deployment contracts.
