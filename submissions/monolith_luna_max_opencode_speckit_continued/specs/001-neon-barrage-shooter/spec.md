# Feature Specification: Neon Barrage Browser Shoot-'Em-Up

**Feature Branch**: `001-neon-barrage-shooter`

**Created**: 2026-08-06

**Status**: Ready for Planning

**Input**: User description: "Read BENCHMARK_TASK.md and produce the complete feature specification for this approved objective. Resolve ambiguities reasonably without asking a human. You are the sole agent and must not delegate."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play a Complete Arcade Run (Priority: P1)

As a player, I want to start and control a real-time arcade shooter so that I can
survive enemy waves, improve my score, and see a clear game outcome.

**Why this priority**: The playable game loop is the core value of Neon Barrage and
must work before secondary features provide value.

**Independent Test**: Open the game without using the leaderboard, start a session,
exercise movement and firing, trigger collisions, reach game over, and restart. The
entire loop is successful when the player can observe score, lives, difficulty,
game-over, and reset behavior.

**Acceptance Scenarios**:

1. **Given** the initial page has loaded, **when** the player activates Start, **then**
   an active game shows a player, enemies, projectiles, score, and lives in the play
   area.
2. **Given** an active game, **when** the player uses Arrow keys or WASD, **then** the
   player moves within the play area without leaving its bounds.
3. **Given** an active game, **when** the player uses Space, **then** projectiles are
   fired and visible feedback confirms the action.
4. **Given** an enemy and a projectile occupy a collision path, **when** they collide,
   **then** the enemy is removed and the score increases.
5. **Given** the player collides with an enemy or an enemy reaches the player,
   **when** the collision is resolved, **then** the lives count decreases and play
   continues while lives remain.
6. **Given** an active game, **when** the session advances, **then** enemy pressure
   increases through a visibly or measurably harder difficulty progression.
7. **Given** the player's lives reach zero, **when** the game-over state appears,
   **then** the final score and score-submission controls are shown.
8. **Given** a game-over state, **when** the player activates Restart, **then** a new
   run starts with the initial score, lives, entities, and active-game state.

---

### User Story 2 - Submit and Revisit a Score (Priority: P1)

As a player, I want to submit my final score under a short name and view a persistent
leaderboard so that my result can be compared with other runs.

**Why this priority**: Persistent scoring is the primary retention and delivery proof
for the approved objective.

**Independent Test**: Reach game over normally or through the deterministic test
surface, enter valid and invalid names, submit a valid score, view the results, and
reload the page. The flow is successful when validation is enforced, the entry is
stored, and the same entry can be observed after reload.

**Acceptance Scenarios**:

1. **Given** a game-over state with a non-negative integer score, **when** the player
   enters a trimmed name from 1 through 16 characters and submits, **then** the score
   is accepted and the leaderboard reflects the entry.
2. **Given** a name that is blank, whitespace-only, longer than 16 characters, or
   contains control characters, **when** the player attempts to submit, **then** the
   submission is rejected with an actionable validation message and no entry is
   created.
3. **Given** a score that is negative, fractional, non-numeric, or outside the
   permitted range, **when** a submission is attempted, **then** the submission is
   rejected by the authoritative data boundary and the leaderboard is unchanged.
4. **Given** more than 10 accepted entries, **when** the leaderboard is displayed,
   **then** at least the 10 highest scores are shown in descending score order.
5. **Given** fewer than 10 accepted entries, **when** the leaderboard is displayed,
   **then** every accepted entry is shown in descending score order.
6. **Given** a successful submission, **when** the player reloads the page, **then**
   the accepted entry remains available.
7. **Given** leaderboard data is loading, empty, or unavailable, **when** the player
   views the leaderboard, **then** a clear corresponding state is shown and the game
   remains playable.
8. **Given** a leaderboard request fails, **when** the player chooses Retry, **then**
   the game attempts the request again without losing the local final score.

---

### User Story 3 - Play Accessibly Across Devices (Priority: P2)

As a player using a keyboard, touch device, or assistive technology, I want the game
controls and status information to remain usable so that device choice does not block
play.

**Why this priority**: The benchmark explicitly requires mobile touch support and the
constitution makes accessibility a release requirement.

**Independent Test**: Exercise the start, gameplay, mute, restart, name, and submit
controls using keyboard navigation on desktop and touch interactions on a narrow
viewport. Confirm that names, focus, status, and error feedback remain understandable.

**Acceptance Scenarios**:

1. **Given** a narrow viewport, **when** the player opens the game, **then** responsive
   layout and touch controls expose movement and firing without blocking the game or
   leaderboard.
2. **Given** the player navigates with a keyboard, **when** focus moves through the
   interactive controls, **then** every control has a visible focus state and an
   understandable accessible name.
3. **Given** the game has audio available, **when** the player has interacted and
   activates Mute, **then** sound is disabled and the control communicates its current
   state.
4. **Given** the browser blocks audio or the player has muted sound, **when** gameplay
   continues, **then** all gameplay and status functions remain usable.
5. **Given** motion or animation is reduced by user preference, **when** the game is
   played, **then** essential feedback remains available without relying on animation.

---

### User Story 4 - Verify a Production Release (Priority: P1)

As the delivery owner, I want to verify the live game and its real leaderboard before
claiming completion so that a local build cannot hide a deployment or data failure.

**Why this priority**: A live URL and a real persistence round trip are explicit
acceptance requirements, not optional operational follow-up.

**Independent Test**: Use the deployed public URL to run the production smoke flow,
perform a real score insert and read, reload the page, and inspect the final evidence
artifact. The release passes only when every result is recorded and no secret is
exposed.

**Acceptance Scenarios**:

1. **Given** the release has been published, **when** the public URL is requested,
   **then** it responds successfully and presents the game without a local-only
   dependency.
2. **Given** the live game is available, **when** the production smoke flow runs,
   **then** start, gameplay, game over, restart, name validation, submission, and
   leaderboard display all work.
3. **Given** a valid score is submitted to the live release, **when** the result is
   read and the page is reloaded, **then** the same result is available through the
   public user flow.
4. **Given** any required test, security, deployment, or round-trip check is missing
   or failing, **when** the final artifact is prepared, **then** completion is not
   claimed and the exact gap is recorded.

### Edge Cases

- Starting, restarting, or submitting repeatedly MUST NOT create duplicate active
  game loops or duplicate leaderboard entries from one user action.
- Holding multiple movement keys, firing continuously, or pressing controls during a
  transition MUST leave the game in one valid state.
- Player, enemy, and projectile positions MUST remain inside their intended play
  boundaries after resize, orientation change, or a narrow viewport transition.
- A game with no leaderboard entries MUST show an explicit empty state rather than a
  broken table or misleading score.
- A slow, timed-out, unauthorized, or unavailable leaderboard service MUST show an
  error and retry path without making gameplay unplayable.
- Equal scores MUST use a deterministic tie order based on earliest accepted
  submission, while all scores remain in descending order.
- Names MUST be treated as text when displayed; markup, script-like content, and
  control characters MUST never execute or alter the page.
- The test adapter MUST reject or ignore invalid test scores and MUST not bypass the
  same validation and submission UI used by normal gameplay.
- A browser that does not grant audio permission MUST still support the complete game
  and leaderboard flows.
- A score outside the non-negative integer range, including fractional, negative,
  extremely large, or forged values, MUST not be persisted.
- A leaderboard with exactly 10 entries MUST show all 10, and one with more than 10
  entries MUST not displace a higher score with a lower score.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The experience MUST load into a clear start state containing the game
  canvas, Start control, score display, lives display, mute control, and leaderboard
  area.
- **FR-002**: The game MUST render a real-time two-dimensional arcade shooter in a
  canvas with a player, enemies, and projectiles.
- **FR-003**: The game MUST support player movement through Arrow keys or WASD and
  firing through Space during an active session.
- **FR-004**: The game MUST provide usable movement and firing touch controls on
  narrow and mobile viewports.
- **FR-005**: The game MUST implement enemy spawning, projectile behavior, collision
  detection, score changes, lives, and a difficulty progression.
- **FR-006**: The game MUST present current score and lives during play and MUST make
  meaningful gameplay feedback visible when an enemy is hit, the player is hit, or
  difficulty increases.
- **FR-007**: The game MUST enter a game-over state when lives are exhausted, show the
  final score and score-submission path, and provide a Restart action that resets the
  session.
- **FR-008**: The visual experience MUST present a coherent art direction, readable
  hierarchy, responsive layout, animation or equivalent feedback, and sufficient
  contrast for gameplay and controls.
- **FR-009**: The game MUST provide sound with a visible mute control. Sound MUST begin
  only after user interaction, and sound failure or mute state MUST not block play.
- **FR-010**: The experience MUST show explicit loading, empty, validation-error, and
  network-error states for leaderboard operations without making the game unplayable.
- **FR-011**: The score-submission form MUST accept a trimmed name of 1 through 16
  characters, reject blank or invalid names with a clear message, and prevent an
  invalid submission from reaching persistence.
- **FR-012**: The score-submission flow MUST submit the final non-negative integer
  score through the public user path and MUST preserve the local score when the
  network is unavailable.
- **FR-013**: The leaderboard MUST show at least the 10 highest accepted entries in
  descending score order, with a deterministic earliest-submission tie order.
- **FR-014**: Accepted leaderboard entries MUST persist across a full page reload and
  MUST remain available after the original game session ends.
- **FR-015**: The authoritative leaderboard data boundary MUST enforce a name length of
  1 through 16 characters, reject control characters, and accept only integer scores
  from 0 through 2,147,483,647.
- **FR-016**: Every table in an exposed data schema MUST enforce row-level access
  controls, and public access MUST be limited to leaderboard reads and new-entry
  creation; public updates, deletes, and administrative operations MUST be denied.
- **FR-017**: No service-role credential, secret key, management credential, or other
  protected value MUST be present in browser-visible assets, committed artifacts,
  logs, or client-visible error messages.
- **FR-018**: A migration SQL artifact MUST reproduce the remote leaderboard schema,
  constraints, and access policies without relying on undocumented manual changes.
- **FR-019**: The production page MUST expose these stable verification selectors:
  `[data-testid="game-canvas"]`, `[data-testid="start-button"]`,
  `[data-testid="score"]`, `[data-testid="lives"]`,
  `[data-testid="mute-button"]`, `[data-testid="leaderboard"]`,
  `[data-testid="player-name"]`, `[data-testid="submit-score"]`, and
  `[data-testid="touch-controls"]`.
- **FR-020**: The production page MUST expose the narrow test surface
  `window.__NEON_BARRAGE__` with `getState`, returning phase, score, lives, playerX,
  playerY, enemyCount, and projectileCount, plus `endGameForTest`, accepting only a
  non-negative integer score and entering the same game-over and score-submission UI
  as normal play.
- **FR-021**: The test surface MUST NOT write directly to the leaderboard or bypass
  client, server, or data-boundary validation, and MUST drive the same UI used by a
  normal player.
- **FR-022**: The project MUST pin dependency versions when dependencies are used,
  retain a lockfile, include local automated tests for meaningful gameplay or data
  behavior, and provide applicable build, lint, and type-check commands.
- **FR-023**: The project MUST include a README describing local setup, controls,
  architecture at a user-relevant level, deployment steps, and security decisions.
- **FR-024**: The frontend MUST be deployed through Cloudflare Pages or Cloudflare
  Workers static assets, and the persistent leaderboard MUST use a newly created
  Supabase project in organization `xfbsknprvxldvgioaows`.
- **FR-025**: Cloudflare and Supabase resource names MUST begin with
  `shootemup-bench-<treatment>-`, and all management credentials MUST be supplied by
  the approved execution environment rather than stored in the project.
- **FR-026**: The candidate root MUST contain `benchmark-result.json` with exactly the
  required public fields: treatment, status, cloudflare_url, cloudflare_project,
  supabase_url, supabase_project_ref, supabase_public_key, verification, and notes.
  The verification object MUST contain exactly `production_http_status`,
  `leaderboard_round_trip`, and `tests_passed`; the public key MUST never be a
  service or secret key.
- **FR-027**: Completion status MUST be reported as complete only after the live
  production URL, real leaderboard insert/read round trip, and applicable automated
  tests have all passed; otherwise the artifact MUST report the actual incomplete
  state and evidence.
- **FR-028**: Source code, tests, migrations, documentation, and deployment evidence
  MUST remain in the candidate directory so the deployed site is not the only artifact.

### Key Entities *(include if feature involves data)*

- **Player**: An anonymous visitor who starts a game, controls the player craft, and
  may submit a final score under a chosen display name. No account is required.
- **Game Session**: One playable run with a phase, score, lives, player position,
  enemy count, projectile count, and a final game-over result.
- **Leaderboard Entry**: A persisted display name, non-negative integer score, and
  accepted-submission ordering information used to show the highest results.
- **Release Evidence Record**: The production URL and project identifiers, test
  outcomes, leaderboard round-trip result, and factual handoff notes required for
  the final benchmark artifact.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of representative desktop and narrow-mobile page-load
  checks reach an actionable start state within 3 seconds on a standard broadband
  connection.
- **SC-002**: In 100% of scripted gameplay checks, a player can start a run, move,
  fire, observe score and lives changes, reach game over, and restart without a page
  reload.
- **SC-003**: In 100% of valid score-submission checks, a 1-16 character name and
  non-negative integer score are accepted, displayed in the correct leaderboard
  position, and still visible after reload.
- **SC-004**: In 100% of invalid-input checks, blank, overlong, control-character,
  negative, fractional, non-numeric, and out-of-range values are rejected without a
  persisted entry.
- **SC-005**: In 100% of leaderboard checks, the visible result contains all entries
  when there are fewer than 10 and the 10 highest entries when there are more, in
  descending score order.
- **SC-006**: 100% of required controls are operable by keyboard on desktop and by
  touch on a narrow viewport, with a visible focus state and understandable status
  feedback.
- **SC-007**: The production smoke run passes the public load, start, gameplay,
  game-over, restart, submission, leaderboard, reload, and real persistence checks;
  no release is marked complete when any check is absent or failed.
- **SC-008**: 100% of security checks find no protected credential in browser-visible
  release artifacts, and unauthorized public data operations are rejected.
- **SC-009**: In a five-person first-use walkthrough, at least four participants can
  identify how to start, control, mute, restart, and submit a score without receiving
  implementation instructions.

## Assumptions

- Neon Barrage is a single-player, anonymous browser game; account creation,
  authentication, social features, multiplayer, chat, and moderation tools are out
  of scope for this release.
- A new session begins at score 0 with 3 lives. The player remains within the play
  area, and difficulty increases through enemy frequency, behavior, or equivalent
  pressure as the session progresses.
- A valid name is trimmed before validation, contains 1 through 16 user-visible
  characters, and contains no control characters. Names may otherwise use normal
  display text; rendered names are always treated as text.
- A valid score is an integer from 0 through 2,147,483,647. The earliest accepted
  submission wins a tie so leaderboard order is deterministic.
- The leaderboard shows the highest 10 entries without search, pagination, editing,
  or deletion in the public experience.
- Touch controls provide both directional movement and firing through clearly
  identifiable on-screen controls. The exact arrangement may be selected during
  planning as long as the required test surface remains stable.
- Audio is an enhancement rather than a dependency. The browser may block audio, and
  gameplay remains fully usable in that case. Audio never starts before interaction.
- The game displays a recoverable retry state for temporary network failure and keeps
  a final score locally until the player can retry or leave the page.
- The approved execution environment provides access to the required Cloudflare and
  Supabase resources, the management credentials `CLOUDFLARE_API_KEY` and
  `SUPABASE_API_KEY` through environment variables, and the treatment identifier used
  in resource names. A tool may receive the corresponding provider-specific token
  variable when required. Credential values are never written to this specification
  or committed artifacts.
- Delivery is bounded by the benchmark's 45-minute execution window. The benchmark
  controller verifies the live leaderboard before pausing the remote project.
- Delivery work remains inside the candidate directory and does not inspect sibling
  candidates, results, or evaluator implementation. The responsible agent does not
  pause the remote project.
- The existing candidate is treated as a greenfield project. The final deliverable
  includes all source and reproducibility artifacts rather than relying on a remote
  deployment alone.
