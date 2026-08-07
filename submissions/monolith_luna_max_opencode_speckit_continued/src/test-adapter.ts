import { MAX_SCORE } from './game/config';
import type { GameSession, GameStateAdapter } from './game/types';

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => GameStateAdapter;
      endGameForTest: (score: number) => void;
    };
  }
}

export function installTestAdapter(getSession: () => GameSession, endGame: (score: number) => void) {
  window.__NEON_BARRAGE__ = {
    getState: () => {
      const session = getSession();
      return {
        phase: session.phase,
        score: session.score,
        lives: session.lives,
        playerX: session.player.x,
        playerY: session.player.y,
        enemyCount: session.enemies.length,
        projectileCount: session.projectiles.length,
      };
    },
    endGameForTest: (score: number) => {
      if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return;
      endGame(score);
    },
  };
}
