# Data Model: Neon Barrage Browser Shoot-'Em-Up

## Client-Only Game State

### GameSession

One active or completed local game run. It is never persisted to Supabase.

| Field | Type | Rules |
|---|---|---|
| `phase` | `ready \| playing \| game-over` | Only one phase is active at a time. |
| `score` | integer | Starts at 0; never negative; capped at 2,147,483,647 before submission. |
| `lives` | integer | Starts at 3; collision can reduce it to 0. |
| `difficultyLevel` | positive integer | Starts at 1 and increases as elapsed play or score crosses thresholds. |
| `elapsedMs` | non-negative number | Advances only while `phase` is `playing`. |
| `player` | `Player` | Position remains inside the play bounds. |
| `enemies` | `Enemy[]` | Each entity has a stable local id and bounded geometry. |
| `projectiles` | `Projectile[]` | Each entity has a stable local id and bounded geometry. |

### Player

The user-controlled craft. It contains normalized or canvas-space `x` and `y`
coordinates, width and height, movement speed, and a collision shape. The renderer
may derive visual effects from this state but must not change scoring or lives.

### Enemy

An active target with `id`, position, dimensions, velocity or movement pattern, and
collision shape. Destroying an enemy removes it from the session and increments the
score. Reaching or colliding with the player reduces lives according to the engine
rules.

### Projectile

An active player-fired object with `id`, position, velocity, dimensions, and a
collision shape. It is removed when it leaves the play bounds or resolves a hit.

### InputState

The normalized input from keyboard and touch sources:

- `left`, `right`, `up`, and `down` movement booleans
- `fire` boolean
- active pointer/touch control state where needed
- a source-independent timestamp or frame edge for one-shot UI actions

The input layer is responsible for clearing released keys and pointer captures so a
lost focus or touch-end event cannot leave movement or firing permanently active.

## Game State Transitions

```text
ready --Start--> playing
playing --lives reaches 0--> game-over
playing --Restart request--> playing with a new initial session
game-over --Restart--> playing with a new initial session
game-over --valid submission--> game-over with submission success state
game-over --submission failure--> game-over with retryable error state
```

The deterministic test adapter may move a `playing` session to `game-over` with a
validated non-negative integer score, but it uses the same game-over and submission
state as normal play. It cannot create a leaderboard entry directly.

## Score Submission State

The UI keeps submission state separate from `GameSession`:

| State | Meaning | Allowed next states |
|---|---|---|
| `idle` | No request is active. | `validating`, `error` |
| `validating` | Client checks name and score shape. | `submitting`, `error` |
| `submitting` | Public insert is in flight. | `success`, `error` |
| `success` | Entry was accepted and the list can refresh. | `success`, `idle` |
| `error` | A validation or network error is visible. | `validating`, `idle` |

The final score remains immutable during `validating` and `submitting`, allowing a
retry without replaying the game.

## Persistent Entity: LeaderboardEntry

Table: `public.leaderboard_entries`

| Field | Type | Source and validation |
|---|---|---|
| `id` | generated identity integer | Server-generated primary key; never accepted from the public client. |
| `name` | text | Must equal its trimmed value, have 1-16 characters, and contain no control characters. |
| `score` | integer | Must be between 0 and 2,147,483,647 inclusive. |
| `created_at` | UTC timestamp | Server default; not writable by the public client. |

Relationships:

- A `GameSession` may produce zero or one accepted `LeaderboardEntry`.
- A `LeaderboardEntry` has no authenticated player relationship.
- `Release Evidence Record` references the remote project and verification result,
  not an individual leaderboard row.

### Ordering and Access Rules

- Reads use `score DESC, created_at ASC, id ASC` and a limit of 10.
- The anonymous role can select rows and insert only `name` and `score`.
- RLS is enabled on the table with a read policy and an insert policy.
- No anonymous update, delete, table-alter, or administrative policy exists.
- Table constraints remain authoritative even when the client is forged.

## Release Evidence Record

The root `benchmark-result.json` records deployment and verification metadata:

| Field | Meaning |
|---|---|
| `treatment` | Benchmark treatment identifier. |
| `status` | `complete` only after all required gates pass. |
| `cloudflare_url` | Actual public production URL. |
| `cloudflare_project` | Actual treatment-prefixed Pages project. |
| `supabase_url` | Actual new project URL. |
| `supabase_project_ref` | Actual project reference. |
| `supabase_public_key` | Public anonymous key only. |
| `verification` | Exactly `production_http_status`, `leaderboard_round_trip`, and `tests_passed`. |
| `notes` | Brief factual handoff, with no secrets. |
