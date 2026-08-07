export type Phase = 'title' | 'playing' | 'gameover';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export interface Enemy extends Entity {
  hp: number;
  kind: 'scout' | 'tank' | 'zig';
  value: number;
  phase: number;
}

export interface Projectile extends Entity {
  fromPlayer: boolean;
  damage: number;
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
  phase: Phase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

export const WORLD_W = 800;
export const WORLD_H = 600;
export const PLAYER_SPEED = 320;
export const PLAYER_FIRE_COOLDOWN = 0.18;
export const START_LIVES = 3;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function aabb(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 16) {
    return 'Name must be 1–16 characters.';
  }
  if (!/^[A-Za-z0-9 _.-]+$/.test(trimmed)) {
    return 'Name may only use letters, numbers, spaces, _ . -';
  }
  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score) || score < 0 || score > 10_000_000) {
    return 'Score must be a plausible non-negative integer.';
  }
  return null;
}

export class Game {
  phase: Phase = 'title';
  score = 0;
  lives = START_LIVES;
  player: Entity;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  spawnTimer = 0;
  fireCooldown = 0;
  invuln = 0;
  elapsed = 0;
  difficulty = 1;
  shake = 0;
  flash = 0;
  starSeed = Math.random() * 1000;

  onScore?: (score: number) => void;
  onLifeLost?: () => void;
  onEnemyDestroyed?: () => void;
  onShoot?: () => void;
  onGameOver?: (score: number) => void;

  constructor() {
    this.player = this.createPlayer();
  }

  private createPlayer(): Entity {
    return {
      x: WORLD_W / 2 - 16,
      y: WORLD_H - 70,
      w: 32,
      h: 28,
      vx: 0,
      vy: 0,
      alive: true,
    };
  }

  reset(): void {
    this.phase = 'playing';
    this.score = 0;
    this.lives = START_LIVES;
    this.player = this.createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.spawnTimer = 0.4;
    this.fireCooldown = 0;
    this.invuln = 1.2;
    this.elapsed = 0;
    this.difficulty = 1;
    this.shake = 0;
    this.flash = 0;
  }

  endGameForTest(score: number): void {
    const safe = Math.max(0, Math.floor(score));
    this.score = safe;
    this.phase = 'gameover';
    this.enemies = [];
    this.projectiles = [];
    this.onGameOver?.(safe);
  }

  getSnapshot(): GameStateSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      playerX: this.player.x,
      playerY: this.player.y,
      enemyCount: this.enemies.filter((e) => e.alive).length,
      projectileCount: this.projectiles.filter((p) => p.alive).length,
    };
  }

  update(dt: number, input: InputState): void {
    if (this.phase !== 'playing') return;

    this.elapsed += dt;
    this.difficulty = 1 + this.elapsed / 35;
    this.shake = Math.max(0, this.shake - dt * 8);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.invuln = Math.max(0, this.invuln - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    this.updatePlayer(dt, input);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updateParticles(dt);
    this.spawnEnemies(dt);
    this.resolveCollisions();
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updatePlayer(dt: number, input: InputState): void {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }
    this.player.x = clamp(this.player.x + dx * PLAYER_SPEED * dt, 8, WORLD_W - this.player.w - 8);
    this.player.y = clamp(this.player.y + dy * PLAYER_SPEED * dt, 40, WORLD_H - this.player.h - 8);

    if (input.fire && this.fireCooldown <= 0) {
      this.fireCooldown = Math.max(0.09, PLAYER_FIRE_COOLDOWN / (1 + this.difficulty * 0.08));
      this.spawnPlayerShot();
      this.onShoot?.();
    }
  }

  private spawnPlayerShot(): void {
    const cx = this.player.x + this.player.w / 2;
    this.projectiles.push({
      x: cx - 3,
      y: this.player.y - 10,
      w: 6,
      h: 14,
      vx: 0,
      vy: -520,
      alive: true,
      fromPlayer: true,
      damage: 1,
    });
    if (this.difficulty > 1.8) {
      this.projectiles.push({
        x: cx - 14,
        y: this.player.y,
        w: 5,
        h: 10,
        vx: -40,
        vy: -480,
        alive: true,
        fromPlayer: true,
        damage: 1,
      });
      this.projectiles.push({
        x: cx + 9,
        y: this.player.y,
        w: 5,
        h: 10,
        vx: 40,
        vy: -480,
        alive: true,
        fromPlayer: true,
        damage: 1,
      });
    }
  }

  private spawnEnemies(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const base = Math.max(0.28, 1.15 - this.difficulty * 0.12);
    this.spawnTimer = base * (0.7 + Math.random() * 0.6);

    const roll = Math.random();
    const kind: Enemy['kind'] =
      roll < 0.55 ? 'scout' : roll < 0.82 ? 'zig' : 'tank';
    const x = 40 + Math.random() * (WORLD_W - 80);
    if (kind === 'scout') {
      this.enemies.push({
        x,
        y: -30,
        w: 28,
        h: 24,
        vx: (Math.random() - 0.5) * 40,
        vy: 70 + this.difficulty * 18,
        alive: true,
        hp: 1,
        kind,
        value: 100,
        phase: Math.random() * Math.PI * 2,
      });
    } else if (kind === 'zig') {
      this.enemies.push({
        x,
        y: -34,
        w: 30,
        h: 26,
        vx: 120 + this.difficulty * 10,
        vy: 55 + this.difficulty * 12,
        alive: true,
        hp: 2,
        kind,
        value: 175,
        phase: 0,
      });
    } else {
      this.enemies.push({
        x,
        y: -40,
        w: 42,
        h: 34,
        vx: (Math.random() - 0.5) * 20,
        vy: 40 + this.difficulty * 8,
        alive: true,
        hp: 4,
        kind,
        value: 300,
        phase: 0,
      });
    }
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.phase += dt;
      if (e.kind === 'zig') {
        e.x += Math.sin(e.phase * 3) * e.vx * dt;
      } else {
        e.x += e.vx * dt;
      }
      e.y += e.vy * dt;
      if (e.x < 8 || e.x + e.w > WORLD_W - 8) e.vx *= -1;
      if (e.y > WORLD_H + 40) e.alive = false;

      if (e.kind === 'tank' && Math.random() < dt * (0.35 + this.difficulty * 0.1)) {
        this.projectiles.push({
          x: e.x + e.w / 2 - 3,
          y: e.y + e.h,
          w: 6,
          h: 12,
          vx: 0,
          vy: 180 + this.difficulty * 20,
          alive: true,
          fromPlayer: false,
          damage: 1,
        });
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < -40 || p.y > WORLD_H + 40 || p.x < -40 || p.x > WORLD_W + 40) {
        p.alive = false;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private resolveCollisions(): void {
    for (const p of this.projectiles) {
      if (!p.alive || !p.fromPlayer) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (!aabb(p, e)) continue;
        p.alive = false;
        e.hp -= p.damage;
        this.burst(e.x + e.w / 2, e.y + e.h / 2, '#39f3ff', 6);
        if (e.hp <= 0) {
          e.alive = false;
          this.score += e.value;
          this.onScore?.(this.score);
          this.onEnemyDestroyed?.();
          this.burst(e.x + e.w / 2, e.y + e.h / 2, e.kind === 'tank' ? '#ffc14d' : '#ff3d9a', 16);
          this.shake = 0.25;
        }
        break;
      }
    }

    if (this.invuln > 0) return;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (aabb(this.player, e)) {
        this.hurtPlayer();
        e.alive = false;
        this.burst(e.x + e.w / 2, e.y + e.h / 2, '#ff4d6d', 12);
        return;
      }
    }

    for (const p of this.projectiles) {
      if (!p.alive || p.fromPlayer) continue;
      if (aabb(this.player, p)) {
        p.alive = false;
        this.hurtPlayer();
        return;
      }
    }
  }

  private hurtPlayer(): void {
    this.lives -= 1;
    this.onLifeLost?.();
    this.invuln = 1.5;
    this.shake = 0.55;
    this.flash = 0.45;
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ffffff', 18);
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'gameover';
      this.onGameOver?.(this.score);
    }
  }

  private burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.45,
        maxLife: 0.7,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }
}
