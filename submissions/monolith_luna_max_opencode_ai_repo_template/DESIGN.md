# Design contract

> **Purpose**: Root design contract for agent-assisted product design and UI implementation.
>
> **For design tools** (OpenDesign, Claude Design, Figma AI exports, etc.): load this file as the primary context before generating mockups or interactive prototypes. It defines product feel, tokens, accessibility floor, layout patterns, and where artifacts land in the repo.
>
> **Template asset note:** Generate this contract only when repository evidence
> shows that the project has a user interface. Replace bracketed prompts from
> verified product evidence before frontend implementation; do not invent them
> merely to complete onboarding.

## Status

- **Project**: Neon Barrage
- **Design owner**: Benchmark delivery agent
- **Current design phase**: Discovery
- **Last reviewed**: 2026-08-07
- **Primary implementation stack**: Browser HTML/CSS/JavaScript with Cloudflare static hosting and a Supabase public client API

## How agents and design tools should use this file

1. Read this file **before** invoking OpenDesign, Claude Design, or any UI generator.
2. Pass relevant sections (product identity, tokens, UX principles, accessibility floor, layout patterns) as context to the design tool — do not rely on the tool's defaults alone.
3. Treat this file as the **root design contract**; generated output must conform to tokens and accessibility rules here unless an explicit decision record says otherwise.
4. Store generated design artifacts under `.context/vision/mockups/<tool>/<YYYY-MM-DD>/` (e.g. `mockups/opendesign/`, `mockups/claude-design/`).
5. Record approved UI decisions in `docs/design/ui-decision.md` or a project-specific equivalent.
6. Do **not** treat generated prototype HTML/React as production source unless the project explicitly chooses that architecture.
7. Keep accessibility requirements visible in every design and implementation handoff.

## Product identity

Neon Barrage is a fast, readable arcade shoot-'em-up with a dark neon visual
language. It should feel energetic and deliberate without sacrificing the
clarity players need while reacting to enemies and projectiles.

- **Personality**: Electric, focused, arcade-like, and welcoming on first play
- **Primary audience**: Desktop and mobile players who want a short replayable arcade session
- **Main user jobs**:
  - Start a run and understand movement and firing immediately
  - Read score, lives, hazards, and escalating difficulty while playing
  - Submit a run score and compare it with the persistent top-ten leaderboard
- **Non-goals**:
  - Accounts, social profiles, or player data beyond a validated name and score
  - A separate administration interface or secret-bearing browser client

## UX principles

1. **Play first**: Make the start action and the control hint obvious without blocking the canvas.
2. **Readable under pressure**: Keep score, lives, hazards, and game state visually distinct from effects.
3. **Fair feedback**: Use motion, sound, and non-color indicators together for hits, damage, and game over.
4. **Input parity**: Keyboard and touch controls must support the same core movement and firing loop.
5. **Safe persistence**: Make leaderboard loading, validation, submission, empty, and network-error states explicit without making the game unplayable.

## Accessibility floor

Every UI direction and implementation should satisfy:

- semantic headings and landmarks
- visible focus states
- keyboard access to all interactive controls
- sufficient color contrast
- non-color-only status indicators
- labels for form controls and icon-only buttons
- readable mobile layouts
- touch targets appropriate for phones and tablets
- reduced-motion compatibility for animated elements
- status updates that can be understood by screen readers
- a text-visible game state and score path alongside the canvas

## Design tokens

Use semantic token names. Do not hard-code final values here unless the project has approved a design system. Design tools should read these names and map them to concrete values in generated mockups.

### Color tokens

| Token | Purpose | Notes |
|---|---|---|
| `color-bg` | Main app background | Near-black blue with a subtle space-like gradient |
| `color-surface` | Cards, panels, dialogs | Deep indigo surface with enough contrast from the canvas |
| `color-surface-muted` | Secondary panels | Desaturated blue-violet for supporting content |
| `color-text` | Primary text | Cool white |
| `color-text-muted` | Secondary text | Soft blue-gray |
| `color-border` | Dividers and outlines | Low-opacity cyan-violet line |
| `color-accent` | Primary action and highlights | Electric cyan |
| `color-success` | Positive state | Must not rely on color alone |
| `color-warning` | Caution state | Must not rely on color alone |
| `color-danger` | Destructive or error state | Must not rely on color alone |
| `color-focus-ring` | Keyboard focus | Bright cyan-white ring with a visible offset |

### Typography tokens

| Token | Purpose | Notes |
|---|---|---|
| `font-sans` | Primary UI typeface | Geometric, highly legible sans-serif with a system fallback |
| `font-mono` | Score and technical values | Monospace with clear digit shapes |
| `text-xs` | Metadata | Control hints and supporting status |
| `text-sm` | Secondary UI text | Labels, leaderboard rows, and errors |
| `text-base` | Body text | Instructions and form text |
| `text-lg` | Section headings | HUD groups and leaderboard heading |
| `text-xl` | Page headings | Product title and game-over score |

### Spacing tokens

| Token | Purpose |
|---|---|
| `space-1` | Tight inline gaps |
| `space-2` | Compact control gaps |
| `space-3` | Card internal spacing |
| `space-4` | Section spacing |
| `space-6` | Page spacing |
| `space-8` | Major layout separation |

## Layout patterns

Define the project's major layout patterns.

- **App shell**: A centered game stage with a compact header, HUD, canvas, and leaderboard surface.
- **Navigation model**: No multi-page navigation; keep the single-session game flow in one view.
- **Dashboard layout**: On desktop, pair the canvas with a leaderboard panel; on narrow screens, stack the panel below the game.
- **Primary task layout**: The canvas is the visual focus, with score/lives/mute controls kept in a stable HUD band.
- **Detail/review layout**: Use a game-over overlay for final score, name entry, submission status, and restart.
- **Modal/dialog usage**: Avoid blocking dialogs during play; use an in-stage overlay for start and game over.
- **Empty states**: Explain that no scores are available yet and keep the start/restart action available.
- **Loading states**: Show a compact leaderboard loading status without covering active gameplay.
- **Error states**: Explain network failure in the leaderboard surface and allow a retry or continued local play.

## Responsive behavior

Define how the UI adapts across common breakpoints.

| Viewport | Design intent | Notes |
|---|---|---|
| Phone | Preserve the play field and touch access | Stack the leaderboard below the canvas; use large directional/fire targets and avoid horizontal scrolling |
| Tablet | Balance play space and supporting information | Keep HUD and touch controls visible while allowing a wider leaderboard panel |
| Laptop/Desktop | Make the game stage and leaderboard feel like one arcade cabinet | Use a two-column layout with a bounded canvas and a stable side panel |

## Component inventory

List expected reusable components. Design tools should align generated UI to these names where possible.

| Component | Purpose | Status |
|---|---|---|
| `GameShell` | Single-view game layout and responsive stage | Planned |
| `GameCanvas` | Real-time shooter rendering surface | Required |
| `Hud` | Score, lives, difficulty feedback, and mute control | Required |
| `StartOverlay` | First-run instructions and start action | Required |
| `TouchControls` | Mobile movement and firing controls | Required |
| `GameOverPanel` | Final score, name entry, submit, and restart | Required |
| `Leaderboard` | Loading, empty, error, and top-ten score states | Required |
| `StatusMessage` | Screen-reader-friendly state announcements | Required |

## Design-tool workflow (OpenDesign, Claude Design, etc.)

Use this workflow when generating UI with external design tools:

1. **Load context**: Provide this `DESIGN.md` (or the relevant sections) to the design tool as system/context input.
2. **Brief**: Start from product requirements and user outcomes — not from implementation files.
3. **Generate directions**: Produce 2–3 distinct prototype directions that honor tokens, UX principles, and the accessibility floor.
4. **Save artifacts**: Export mockups, HTML, or tool-native files under `.context/vision/mockups/<tool>/<YYYY-MM-DD>/` with a short `README.md` describing each file.
5. **Critique**: Review against user outcomes, accessibility, implementation simplicity, and maintainability.
6. **Decide**: Record the selected direction in `docs/design/ui-decision.md`.
7. **Implement**: Frontend agents translate the approved direction into production components in the app's source tree — referencing mockups as **design input**, not copy-paste source, unless explicitly approved.

## Design artifact locations

| Path | Purpose |
|---|---|
| `DESIGN.md` | Root design contract (this file) |
| `.context/vision/README.md` | Vision and design-artifact index |
| `.context/vision/mockups/` | Generated or hand-authored mockups/prototypes |
| `.context/vision/mockups/opendesign/` | OpenDesign exports (convention) |
| `.context/vision/mockups/claude-design/` | Claude Design exports (convention) |
| `.context/vision/architecture/` | Architecture diagrams and user-flow diagrams |
| `docs/design/` | Human-readable design decisions, critiques, and handoffs |
| `src/**` | Production implementation, if the derived project has runtime code |

## Implementation handoff checklist

Before frontend implementation starts:

- [ ] `DESIGN.md` has been customized for the project.
- [ ] Mockups or prototypes exist under `.context/vision/mockups/`.
- [ ] A design decision has been recorded under `docs/design/`.
- [ ] Accessibility requirements are explicit.
- [ ] The component inventory is known.
- [ ] The implementation agent knows which prototype artifacts are references only.
- [ ] The production stack and test strategy are documented.

## Decision log

| Date | Decision | Rationale | Link |
|---|---|---|---|
| 2026-08-07 | Use a single-view neon arcade layout with canvas-first play and a responsive leaderboard | The benchmark requires fast gameplay, touch support, readable state, and persistent score comparison | `BENCHMARK_TASK.md` |

## Open questions

- [ ] Which browser implementation approach best fits the time-box without weakening the canvas and Supabase requirements?
- [ ] Will Cloudflare Pages or Workers static assets be the final hosting target?
- [ ] Which concrete font assets, if any, are acceptable for the final bundle?
- [ ] Is a hand-authored mockup needed before implementation, or is this contract sufficient for the benchmark time-box?

## Related references

- `.context/roadmap.md` - project milestones and issue-backed future work
- `.context/vision/README.md` - mockup and diagram index
