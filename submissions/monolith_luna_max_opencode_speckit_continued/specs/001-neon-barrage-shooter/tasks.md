# Tasks: Neon Barrage Browser Shoot-'Em-Up

**Input**: Design documents from `/specs/001-neon-barrage-shooter/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/`, and `quickstart.md`

**Execution constraint**: The responsible agent is the sole implementer. Tasks are
ordered for one-agent execution; `[P]` marks independent file work that can be
interleaved without waiting for another incomplete task.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the static web application, development commands, and
repository-safe configuration.

- [x] T001 Initialize the pinned React, TypeScript, Vite, Supabase client, Vitest, React Testing Library, Playwright, ESLint, and TypeScript dependencies and scripts in `package.json`, then record the resulting dependency graph in `package-lock.json`.
- [x] T002 [P] Configure TypeScript compilation and Vite build behavior in `tsconfig.json` and `vite.config.ts` for a browser-targeted static `dist/` output.
- [x] T003 [P] Configure linting, test discovery, browser base URL, and test setup in `eslint.config.js`, `playwright.config.ts`, and `tests/setup.ts`.
- [x] T004 [P] Define public build variables and secret exclusions in `.env.example` and `.gitignore`, including `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and local environment files.
- [x] T005 [P] Create the Vite document and application entry shell in `index.html`, `src/main.tsx`, `src/App.tsx`, and `src/styles.css` with the page title Neon Barrage and a mountable root.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared types, environment boundaries, persistence policy, and
status primitives before user-story implementation.

**Checkpoint**: Foundation is ready when the project starts, type checks, and has a
reviewable migration with no public secret or update/delete path.

- [x] T006 [P] Define the shared game and leaderboard type contracts in `src/game/types.ts` and `src/leaderboard/types.ts`, including session phases, entity shapes, leaderboard entries, and submission states from `data-model.md`.
- [x] T007 [P] Define game constants and fail-closed public environment parsing in `src/game/config.ts` and `src/config/env.ts`, including the initial three lives, score bounds, and required public Supabase variables.
- [x] T008 [P] Create `supabase/migrations/20260806_create_leaderboard_entries.sql` with the `public.leaderboard_entries` table, server-generated identity/timestamp, trimmed name and control-character checks, integer score bounds, grants, RLS, select/insert policies, and no public update/delete privileges.
- [x] T009 [P] Implement reusable loading, empty, error, retry, and status semantics in `src/components/StatusMessage.tsx` for non-blocking leaderboard and audio failures.
- [x] T010 [P] Add deterministic leaderboard fixtures and a mock public data boundary in `tests/fixtures/leaderboard.ts` for isolated UI and client tests without real credentials.
- [x] T011 Establish the root state ownership and dependency seams in `src/App.tsx`, keeping React UI state, the pure game session, submission state, and leaderboard client separate.

---

## Phase 3: User Story 1 - Play a Complete Arcade Run (Priority: P1) MVP

**Goal**: Deliver a standalone playable run with movement, firing, enemies,
collisions, score, lives, difficulty, game over, restart, canvas feedback, and the
production test adapter transition.

**Independent Test**: Start the app without relying on leaderboard persistence, use
keyboard controls to play or invoke the adapter to reach game over, confirm the state
and HUD changes, then restart and confirm a clean initial session.

### Tests for User Story 1

> Write these tests first and confirm they fail before implementing the corresponding
> engine, collision, and UI behavior.

- [x] T012 [P] [US1] Write failing deterministic engine tests in `tests/unit/engine.test.ts` for initial state, keyboard movement bounds, firing, enemy spawning, score changes, lives reduction, difficulty escalation, game-over, restart, and bounded frame deltas.
- [x] T013 [P] [US1] Write failing collision tests in `tests/unit/collision.test.ts` for projectile-enemy removal, player-enemy damage, enemy boundary behavior, duplicate collision prevention, and score/lives effects.
- [x] T014 [P] [US1] Write failing browser flow tests in `tests/e2e/game-flow.spec.ts` for the required canvas/HUD/start selectors, keyboard controls, game-over/restart, and `window.__NEON_BARRAGE__` state and `endGameForTest` behavior.

### Implementation for User Story 1

- [x] T015 [US1] Implement the pure deterministic simulation transition in `src/game/engine.ts` using typed state, injected randomness, fixed-step updates, movement bounds, firing cadence, enemy lifecycle, score, lives, difficulty, game-over, and restart rules.
- [x] T016 [US1] Implement axis-aligned collision resolution and entity cleanup in `src/game/collision.ts` without mutating score or lives more than once per resolved collision.
- [x] T017 [US1] Implement keyboard input capture, release handling, focus-loss reset, and Arrow/WASD/Space normalization in `src/game/input.ts` without allowing gameplay keys to scroll the page.
- [x] T018 [US1] Implement canvas drawing for player, enemies, projectiles, score feedback, hit feedback, and game-over visuals in `src/game/render.ts` with device-pixel-ratio-aware sizing.
- [x] T019 [US1] Connect the pure engine to a bounded `requestAnimationFrame` loop and canvas resize lifecycle in `src/components/GameCanvas.tsx`, exposing `data-testid="game-canvas"` in production.
- [x] T020 [US1] Implement the live score and lives HUD plus required `data-testid="score"` and `data-testid="lives"` elements in `src/components/Hud.tsx`.
- [x] T021 [P] [US1] Implement the start and core game-over/restart panels in `src/components/StartPanel.tsx` and `src/components/GameOverPanel.tsx`, including `data-testid="start-button"` and a visible final score without leaderboard submission logic.
- [x] T022 [US1] Wire game start, frame updates, game-over, restart, and the production adapter contract through `src/App.tsx` and `src/test-adapter.ts`, ensuring `getState` is read-only and `endGameForTest` uses the normal game-over state.
- [x] T023 [US1] Add the deliberate visual system, responsive game layout, canvas feedback, HUD hierarchy, and initial contrast rules in `src/styles.css`.
- [x] T024 [US1] Run and fix the User Story 1 unit and browser tests in `tests/unit/engine.test.ts`, `tests/unit/collision.test.ts`, and `tests/e2e/game-flow.spec.ts`, then record the standalone gameplay checkpoint in `README.md`.

---

## Phase 4: User Story 2 - Submit and Revisit a Score (Priority: P1)

**Goal**: Add the validated public leaderboard flow, top-10 ordering, persistence,
loading/empty/error/retry states, and database-enforced security.

**Independent Test**: Use the completed game-over UI or the deterministic adapter to
submit valid and invalid values against mocked and real public data boundaries, then
reload and verify the accepted entry and ordering.

### Tests for User Story 2

> Write these tests first and confirm they fail before implementing validation,
> leaderboard access, or submission UI.

- [x] T025 [P] [US2] Write failing input validation tests in `tests/unit/validation.test.ts` for trimming, blank names, 1-16 character limits, control characters, integer score bounds, negative/fractional/oversized scores, and safe text rendering inputs.
- [x] T026 [P] [US2] Write failing public client integration tests in `tests/integration/leaderboard-client.test.ts` for top-10 ordering, deterministic ties, insert payload shape, loading/error mapping, and retry preservation of the final score.
- [x] T027 [P] [US2] Write failing UI flow tests in `tests/integration/app-flow.test.tsx` for game-over name validation, submit success, list refresh, loading/empty/error states, Retry, and reload persistence using the fixture boundary.
- [x] T028 [P] [US2] Write failing schema contract checks in `tests/integration/leaderboard-schema.test.ts` for RLS enabled, public select/insert only, rejected invalid values, server-managed fields, and denied update/delete operations.

### Implementation for User Story 2

- [x] T029 [US2] Implement shared client-side name and score validation in `src/leaderboard/validation.ts` using the same bounds defined by the migration.
- [x] T030 [US2] Implement the typed Supabase public client in `src/leaderboard/client.ts` with top-10 ordering, `{ name, score }` inserts, safe error mapping, and no management credential access.
- [x] T031 [US2] Implement the leaderboard list/table in `src/components/Leaderboard.tsx` with `data-testid="leaderboard"`, loading/empty/error/retry states, descending score order, deterministic ties, and safe text rendering.
- [x] T032 [US2] Extend `src/components/GameOverPanel.tsx` with the 1-16 character name field, `data-testid="player-name"`, `data-testid="submit-score"`, validation messaging, submitting state, success state, and retryable error state.
- [x] T033 [US2] Wire initial leaderboard loading, game-over submission, list refresh, reload persistence, local final-score retention, and network-error handling through `src/App.tsx`.
- [x] T034 [US2] Update `src/test-adapter.ts` and `src/App.tsx` so adapter-triggered game over reaches the same name validation and submit path and cannot call `src/leaderboard/client.ts` directly.
- [x] T035 [US2] Apply `supabase/migrations/20260806_create_leaderboard_entries.sql` to the new project and make `tests/integration/leaderboard-schema.test.ts` prove the committed schema matches the public leaderboard contract.
- [x] T036 [US2] Run and fix the User Story 2 tests in `tests/unit/validation.test.ts`, `tests/integration/leaderboard-client.test.ts`, `tests/integration/app-flow.test.tsx`, and `tests/integration/leaderboard-schema.test.ts`, then record the standalone submission checkpoint in `README.md`.

---

## Phase 5: User Story 3 - Play Accessibly Across Devices (Priority: P2)

**Goal**: Make the game playable through narrow/mobile touch controls and keyboard
navigation, with accessible status, sound, mute, responsive layout, and reduced-motion
behavior.

**Independent Test**: At a narrow viewport, use touch movement and firing; at desktop,
navigate all controls by keyboard; activate mute and reduced-motion preferences; then
confirm gameplay, status, submission, and error flows remain usable.

### Tests for User Story 3

> Write these tests first and confirm they fail before implementing touch, audio, and
> accessibility enhancements.

- [x] T037 [P] [US3] Write failing browser accessibility and touch tests in `tests/e2e/accessibility.spec.ts` for narrow layout, `data-testid="touch-controls"`, keyboard focus, accessible names, score/lives status, mute state, and form/list semantics.
- [x] T038 [P] [US3] Write failing audio and reduced-motion tests in `tests/unit/audio.test.ts` for user-gesture-only initialization, mute behavior, audio failure fallback, and reduced-motion feedback selection.

### Implementation for User Story 3

- [x] T039 [US3] Extend `src/game/input.ts` with pointer/touch capture, directional movement, firing, release/cancel cleanup, and shared `InputState` parity with keyboard input.
- [x] T040 [US3] Implement responsive on-screen movement and firing controls in `src/components/TouchControls.tsx` with `data-testid="touch-controls"` and touch-safe pointer behavior.
- [x] T041 [US3] Implement lazy user-gesture audio creation, sound effects, mute state, and failure-safe no-audio behavior in `src/game/audio.ts`.
- [x] T042 [P] [US3] Add accessible labels, focus-visible styling hooks, live status semantics, and mute state messaging in `src/components/Hud.tsx` and `src/components/StatusMessage.tsx`.
- [x] T043 [P] [US3] Add accessible names, keyboard-submit behavior, list/table semantics, validation announcements, and retry semantics in `src/components/StartPanel.tsx`, `src/components/GameOverPanel.tsx`, and `src/components/Leaderboard.tsx`.
- [x] T044 [US3] Add mobile breakpoints, touch target sizing, contrast, focus styling, and reduced-motion alternatives in `src/styles.css`.
- [x] T045 [US3] Wire touch controls, audio initialization after interaction, mute button `data-testid="mute-button"`, reduced-motion preference, and responsive status behavior through `src/App.tsx`.
- [x] T046 [US3] Run and fix the User Story 3 tests in `tests/e2e/accessibility.spec.ts` and `tests/unit/audio.test.ts`, then record desktop/mobile accessibility evidence in `README.md`.

---

## Phase 6: User Story 4 - Verify a Production Release (Priority: P1 Release Gate)

**Goal**: Publish the finished application and prove the live URL, schema, public
leaderboard round trip, tests, and evidence artifact before claiming completion.

**Independent Test**: Against the deployed URL, receive HTTP 200, run the stable
selector smoke flow, submit a unique valid score through the normal UI, read it back
after reload, inspect the public bundle for secrets, and verify the exact evidence
shape.

### Tests for User Story 4

> Write these tests first and confirm they fail before implementing production
> verification or deployment evidence.

- [x] T047 [P] [US4] Write failing production smoke tests in `tests/e2e/production.spec.ts` for HTTP success, all required selectors, start/play/game-over/restart, adapter parity, valid submission, leaderboard ordering, reload persistence, and public error behavior.

### Implementation and Release for User Story 4

- [x] T048 [P] [US4] Implement `scripts/verify-production.mjs` to check the public URL, stable selectors, adapter-driven game over, unique valid score submission, leaderboard read/reload persistence, HTTP status, and secret-safe release output.
- [x] T049 [P] [US4] Write `README.md` with local setup, controls, architecture boundaries, test commands, Supabase migration/RLS decisions, Cloudflare Pages deployment steps, security decisions, and evidence commands.
- [x] T050 [US4] Provision the new treatment-prefixed Supabase project in organization `xfbsknprvxldvgioaows`, apply `supabase/migrations/20260806_create_leaderboard_entries.sql`, and record the actual project URL/ref without storing management credentials.
- [x] T051 [US4] Build and deploy `dist/` to the treatment-prefixed Cloudflare Pages project using the approved Cloudflare credential mapping and the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configuration.
- [x] T052 [US4] Run `tests/e2e/production.spec.ts` and `scripts/verify-production.mjs` against the actual production URL, including a real public insert/read/reload round trip and RLS rejection checks.
- [x] T053 [US4] Write `benchmark-result.json` with exactly the required public fields and actual Cloudflare/Supabase identifiers, setting `verification.production_http_status`, `verification.leaderboard_round_trip`, and `verification.tests_passed` only from observed results.
- [x] T054 [US4] Audit `benchmark-result.json`, `dist/`, `.env.example`, `supabase/migrations/20260806_create_leaderboard_entries.sql`, and `README.md` for protected credentials and unsupported completion claims, leaving status incomplete if any release gate is missing.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete the constitution quality gates, align documentation, and leave
reproducible evidence for the final handoff.

- [x] T055 Run the full local quality sequence from `specs/001-neon-barrage-shooter/quickstart.md` through `package.json`: lint, typecheck, unit/integration tests, production build, and browser tests.
- [x] T056 [P] Re-audit grants, RLS, constraints, public columns, and migration reproducibility in `supabase/migrations/20260806_create_leaderboard_entries.sql` against `contracts/leaderboard.md`.
- [x] T057 [P] Profile and tune frame timing, entity cleanup, canvas rendering, and responsive layout in `src/game/engine.ts`, `src/game/render.ts`, and `src/styles.css` to preserve the 60 FPS target without changing behavior.
- [x] T058 [P] Align final setup, deployment, security, test, and evidence instructions in `README.md` with `specs/001-neon-barrage-shooter/quickstart.md` and the actual scripts in `package.json`.
- [x] T059 Run every scenario in `specs/001-neon-barrage-shooter/quickstart.md`, including local gates, schema checks, production smoke, and real leaderboard persistence, and record command outcomes in `README.md`.
- [x] T060 Perform the final evidence review in `benchmark-result.json`, `README.md`, `tests/`, `supabase/migrations/20260806_create_leaderboard_entries.sql`, and `dist/`; report completion only if all constitution and benchmark gates pass.

---

## Dependencies & Execution Order

### Phase Dependencies

`Phase 1 Setup -> Phase 2 Foundational -> User Story 1 -> User Story 2 -> User
Story 3 -> User Story 4 -> Phase 7 Polish`.

Phase 2 blocks user-story work because it establishes the public environment boundary,
shared types, migration, test fixtures, and root state seams. User Story 4 is listed
after User Story 3 despite its P1 label because live verification cannot pass until
the gameplay, leaderboard, and accessibility paths are all present.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Phase 2 and is the MVP increment.
- **User Story 2 (P1)**: Uses the User Story 1 game-over and adapter seams, but can
  validate its client and database boundary with fixtures independently.
- **User Story 3 (P2)**: Uses the shared engine and UI components; its keyboard/touch,
  audio, and accessibility tests can run independently once Phase 2 exists.
- **User Story 4 (P1 release gate)**: Depends on User Stories 1, 2, and 3 plus the
  foundational migration and configuration; it is not a substitute for their tests.

### Within Each User Story

Tests MUST be written and observed failing before the corresponding implementation.
Types and contracts precede services and components; pure engine/client behavior
precedes UI integration; integration and production checks follow implementation.
Every story ends with its own test run and checkpoint before the next dependent phase.

### Dependency Graph

```text
T001
├── T002-T005
└── T006-T011
    └── T012-T014 -> T015-T023 -> T024
        └── T025-T028 -> T029-T035 -> T036
            └── T037-T038 -> T039-T045 -> T046
                └── T047 -> T048-T054
                    └── T055-T060
```

### Parallel Execution Examples

| Story or phase | Parallel batch | Preconditions |
|---|---|---|
| Setup | T002, T003, T004, T005 | T001 complete |
| Foundation | T006, T007, T008, T009, T010 | T001-T005 complete |
| US1 tests | T012, T013, T014 | T006, T007, and T011 complete |
| US2 tests | T025, T026, T027, T028 | US1 checkpoint T024 complete |
| US3 tests | T037, T038 | US2 checkpoint T036 complete |
| US4 preparation | T048, T049 | T047 is written and failing; US1-US3 checkpoints complete |
| Polish audits | T056, T057, T058 | T054 complete; T055 runs after this batch |

All parallel work remains within the sole-agent constraint: the batches identify
non-conflicting file work that can be handled in any order, not delegated agents.

## Implementation Strategy

### MVP First: User Story 1 Only

1. Complete T001-T011 to establish the foundation.
2. Complete T012-T024, keeping tests ahead of engine and UI implementation.
3. Stop and validate the standalone game loop through the unit and browser tests.
4. Do not claim the benchmark objective is complete until User Stories 2-4 and the
   final evidence gates are also complete.

### Incremental Delivery

1. Setup and foundation produce a runnable, typed shell and reviewable secure schema.
2. User Story 1 adds a playable game and test adapter.
3. User Story 2 adds persistent scoring and RLS-backed leaderboard behavior.
4. User Story 3 adds mobile, keyboard, audio, and accessibility release behavior.
5. User Story 4 deploys and verifies the complete product with factual evidence.
6. Phase 7 re-runs every quality gate and leaves the candidate directory reproducible.

### Traceability Summary

| Requirement area | Primary tasks |
|---|---|
| Game loop and canvas | T012-T024 |
| Leaderboard validation, persistence, and RLS | T008, T025-T036, T050, T052 |
| Touch, keyboard, audio, and accessibility | T017, T037-T046 |
| Stable selectors and test adapter | T014, T022, T031-T034, T047-T048 |
| Build, tests, lockfile, and README | T001-T005, T049, T055, T058 |
| Cloudflare deployment and production verification | T050-T054, T059-T060 |

## Notes

- Every executable task begins with `- [ ]`, has a sequential `T###` ID, uses `[P]`
  only for non-conflicting parallel work, uses a required `[US#]` label in story
  phases, and names the target file or directory.
- No task delegates work or inspects excluded sibling, results, or evaluator paths.
- The final task must not set completion true from local success alone; live URL and
  real leaderboard evidence are release-blocking.
