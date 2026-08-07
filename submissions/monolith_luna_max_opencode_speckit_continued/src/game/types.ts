export type Phase = 'ready' | 'playing' | 'game-over';

export interface Bounds {
  width: number;
  height: number;
}

export interface EntityRect {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Player extends EntityRect {
  speed: number;
  invulnerableMs: number;
}

export interface Enemy extends EntityRect {
  vx: number;
  vy: number;
  hp: number;
}

export interface Projectile extends EntityRect {
  vy: number;
  damage: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

export interface GameSession {
  phase: Phase;
  score: number;
  lives: number;
  difficultyLevel: number;
  elapsedMs: number;
  nextEntityId: number;
  fireCooldownMs: number;
  spawnCooldownMs: number;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  bounds: Bounds;
}

export interface GameStateAdapter {
  phase: Phase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
}
