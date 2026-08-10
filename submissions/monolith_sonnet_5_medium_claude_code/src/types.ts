export type GamePhase = "idle" | "playing" | "gameover";

export interface Vector2 {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  fireCooldown: number;
  invulnerable: number;
}

export interface Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  scoreValue: number;
  wobble: number;
  fireCooldown: number;
  fires: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  fromPlayer: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameStateSnapshot {
  phase: GamePhase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
}

export interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  created_at: string;
}
