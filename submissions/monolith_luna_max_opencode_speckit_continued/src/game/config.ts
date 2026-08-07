import type { Bounds, InputState } from './types';

export const WORLD_BOUNDS: Bounds = { width: 960, height: 640 };
export const INITIAL_LIVES = 3;
export const MAX_SCORE = 2_147_483_647;
export const PLAYER_SIZE = { width: 34, height: 28 };
export const PLAYER_SPEED = 360;
export const PROJECTILE_SPEED = 620;
export const ENEMY_SIZE = { width: 32, height: 28 };
export const FIRE_INTERVAL_MS = 160;

export const EMPTY_INPUT: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
};

export function difficultyFor(elapsedMs: number, score: number): number {
  return Math.max(1, 1 + Math.floor(elapsedMs / 15_000) + Math.floor(score / 500));
}
