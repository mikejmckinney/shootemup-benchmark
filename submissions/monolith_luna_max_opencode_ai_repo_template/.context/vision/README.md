# Vision & Design Artifacts

> **Purpose**: Keep Neon Barrage's product design direction, mockups, and
> architecture diagrams discoverable without mixing them into production code.

## What Belongs Here

- `architecture/` holds diagrams for the game and its external-state boundaries.
- `mockups/` holds optional design-tool exports and hand-authored prototypes.

`DESIGN.md` is the root UI contract. The benchmark brief is the source for
required game behavior and deployment constraints; generated prototypes remain
design input rather than production source.

## Current Artifacts

- [../../DESIGN.md](../../DESIGN.md) - product identity, tokens, responsive
  behavior, and accessibility floor.
- [architecture/state-surfaces.md](architecture/state-surfaces.md) - inherited
  GitHub-first coordination state guidance.

## How to Use These Files

1. Read `DESIGN.md` before frontend or design-tool work.
2. Read `architecture/state-surfaces.md` when touching GitHub state, local state
   mirrors, or onboarding reset behavior.
3. Keep product milestones aligned with `.context/roadmap.md` and benchmark
   acceptance criteria aligned with `BENCHMARK_TASK.md`.

## Related References

- [../00_INDEX.md](../00_INDEX.md)
- [../roadmap.md](../roadmap.md)
- [../state/README.md](../state/README.md)
- [../../docs/guides/agent-pipeline.md](../../docs/guides/agent-pipeline.md)
