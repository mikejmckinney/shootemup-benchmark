# Research: Neon Barrage Browser Shoot-'Em-Up

This research resolves the technical choices and unknowns identified by the plan.
It uses the repository task contract, the approved specification, the project
constitution, and established browser application practices. No external agent was
delegated.

## Application Stack

**Decision**: Use React 19, TypeScript 5.x, and Vite on Node.js 20 LTS.

**Rationale**: The project is a greenfield static browser application. Vite provides
a fast static build suitable for Cloudflare Pages, TypeScript makes game state and
database payloads explicit, and React handles the start, game-over, leaderboard,
loading, and error states without putting simulation state into the component tree.

**Alternatives considered**: A vanilla TypeScript app would reduce dependencies but
would require more manual UI state wiring. A server-rendered or full-stack framework
would add deployment and server complexity that the static hosting requirement does
not need.

## Game Simulation Boundary

**Decision**: Keep the simulation in pure TypeScript functions with a typed state,
explicit input state, bounded time step, and injectable seeded randomness. React and
the canvas adapter consume state but do not own collision or scoring rules.

**Rationale**: Pure transitions make collision, score, lives, difficulty, game-over,
and restart behavior deterministic under unit tests. A bounded animation delta avoids
large jumps after a hidden tab or slow frame while keeping the implementation small.

**Alternatives considered**: A physics library is unnecessary for the simple arcade
geometry and would add bundle and setup cost. Storing entities in React state would
cause avoidable render churn and make frame-level behavior harder to test.

## Rendering and Input

**Decision**: Render gameplay in one canvas and keep controls/status/forms in
semantic DOM. Normalize the game coordinate system to the canvas dimensions, scale
the backing buffer for device pixel ratio, and use one `InputState` for keyboard and
touch sources.

**Rationale**: The canvas satisfies the explicit game requirement while DOM controls
remain keyboard accessible, focusable, screen-reader discoverable, and easy to target
with the required selectors. A single input model prevents keyboard and touch paths
from diverging.

**Alternatives considered**: Rendering all entities as DOM nodes would not meet the
canvas requirement and would complicate animation. Separate keyboard and touch game
logic would duplicate collision-facing behavior and weaken parity testing.

## Audio and Accessibility

**Decision**: Create the audio context only from a user gesture, expose a visible
mute toggle, treat audio as optional, support reduced-motion preferences, and keep
all important game status in text outside the canvas.

**Rationale**: Browsers commonly block autoplay. Lazy creation preserves that policy,
and a failed audio context cannot block the game. Semantic controls, focus styling,
text status, and touch targets address the constitution's release gate.

**Alternatives considered**: Autoplaying audio is prohibited by the task. Canvas-only
status would be inaccessible and would make black-box state verification harder.

## Supabase Data Boundary

**Decision**: Use one `public.leaderboard_entries` table with `id`, `name`, `score`,
and server-generated `created_at`. Grant the anonymous role only select and insert
of `name` and `score`; enable RLS; add read and insert policies; provide no public
update, delete, or administrative operation.

**Rationale**: One table is sufficient for anonymous scores and minimizes exposed
surface. Database checks enforce trimmed 1-16 character names without control
characters and integer scores from 0 through 2,147,483,647, so forged clients cannot
weaken the contract. Server-generated ordering fields prevent clients from choosing
their rank.

**Alternatives considered**: Authentication would reduce anonymous accessibility and
is not required by the task. Multiple tables or a server-side API would increase
scope and introduce a secret-bearing server path. Client-only validation is rejected
because it cannot protect a public database boundary.

## Leaderboard Read and Write Behavior

**Decision**: Read entries ordered by `score DESC`, then `created_at ASC`, then `id
ASC`, limited to 10. Submit only `{ name, score }` through the same form path used by
normal play. Map invalid input and network errors to explicit UI states while keeping
the local final score available for retry.

**Rationale**: The order satisfies the top-10 requirement and gives deterministic
tie behavior. The client module can be mocked for local tests while the migration and
production smoke test prove the real data path.

**Alternatives considered**: Client-side sorting or a larger unbounded read would
allow inconsistent ranking and unnecessary data exposure. Allowing client-provided
timestamps would make ties and ordering forgeable.

## Deployment and Configuration

**Decision**: Deploy the Vite `dist` output to Cloudflare Pages with Wrangler. Create
the new treatment-prefixed Supabase project using the supplied management credential,
apply the committed migration, and expose only `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` to the frontend build. Keep `SUPABASE_API_KEY` and
`CLOUDFLARE_API_KEY` in the execution environment, mapping them to provider-specific
token names only for CLI commands when necessary.

**Rationale**: Pages is the simplest approved static target and does not require a
custom server. The public anonymous key is intentionally client-visible; management
and service-role credentials are not. A committed migration makes the remote schema
reproducible and reviewable.

**Alternatives considered**: Workers static assets are valid but add a worker
configuration path without a requirement for server logic. Embedding management
credentials or using a service-role key in the browser is prohibited.

## Verification Strategy

**Decision**: Use Vitest for pure engine and validation tests, React Testing Library
for form/state integration, and Playwright for the stable-selector adapter flow and
production smoke. Add a bundle secret scan, migration policy checks, build/lint/type
checks, and a real production insert/read/reload verification before writing the
final artifact.

**Rationale**: Each layer tests the boundary it owns. The deterministic adapter makes
game-over and score submission reproducible without depending on random gameplay,
while the production check proves deployment and persistence rather than only local
behavior.

**Alternatives considered**: Manual-only checks cannot provide repeatable evidence.
Unit tests alone cannot verify browser interaction, deployed assets, or a real RLS
round trip.

## Delivery Scope

**Decision**: Keep the first release to one player, one game session at a time, one
public leaderboard, and no authentication, moderation, multiplayer, or admin UI.

**Rationale**: These boundaries fit the 45-minute benchmark window and preserve the
explicit acceptance surface. Any future abuse controls or authenticated features
would require a separate approved specification.

**Alternatives considered**: Building extra account, moderation, or multiplayer
features would consume time without improving the approved objective and would expand
the security surface.
