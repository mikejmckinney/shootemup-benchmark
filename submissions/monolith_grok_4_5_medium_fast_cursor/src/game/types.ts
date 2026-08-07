export type Phase = 'menu' | 'playing' | 'gameover';

export type Vec = { x: number; y: number };

export type Player = {
  x: number;
  y: number;
  radius: number;
  invulnMs: number;
};

export type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fromPlayer: boolean;
};

export type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  kind: 'scout' | 'bruiser' | 'drifter';
  pulse: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type GameStateSnapshot = {
  phase: Phase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
};

export type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
};
