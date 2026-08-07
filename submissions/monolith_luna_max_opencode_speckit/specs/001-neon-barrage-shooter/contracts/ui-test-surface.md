# UI Test Surface Contract

The following hooks are stable production contracts. Their names must not change
without an approved specification update.

## Required Selectors

| Element | Required selector |
|---|---|
| Game canvas | `[data-testid="game-canvas"]` |
| Start control | `[data-testid="start-button"]` |
| Score display | `[data-testid="score"]` |
| Lives display | `[data-testid="lives"]` |
| Mute control | `[data-testid="mute-button"]` |
| Leaderboard list/table | `[data-testid="leaderboard"]` |
| Name input | `[data-testid="player-name"]` |
| Submit score control | `[data-testid="submit-score"]` |
| Touch controls container | `[data-testid="touch-controls"]` |

Selectors must identify the visible, active element or container and must be present
in the production build, not only in a test mode.

## Test Adapter

Production exposes one narrow object:

```ts
window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase,
    score,
    lives,
    playerX,
    playerY,
    enemyCount,
    projectileCount,
  }),
  endGameForTest: (score) => {
    // transition through the normal game-over and submission UI
  },
};
```

Contract rules:

- `getState` reports the current production game state without mutating it.
- `phase` is `ready`, `playing`, or `game-over`.
- `score` and `lives` are integers; positions and entity counts are finite values.
- `endGameForTest` accepts only a non-negative integer score in the database range.
- Invalid adapter input is rejected or ignored without changing the game.
- A valid adapter call uses the same game-over, name validation, submit, loading,
  error, and leaderboard UI as normal play.
- The adapter never writes directly to Supabase and never bypasses validation.
