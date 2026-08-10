/**
 * Neon Barrage — headless game simulation.
 *
 * This module contains no DOM/canvas access so it can be unit tested in Node.
 * Rendering (src/render.ts) and wiring (src/main.ts) consume the state it owns.
 */

export const WORLD_W = 480;
export const WORLD_H = 720;

export type Phase = 'menu' | 'playing' | 'paused' | 'gameover';

export interface Vec {
  x: number;
  y: number;
}

export interface Player extends Vec {
  r: number;
  cooldown: number;
  invuln: number;
  alive: boolean;
}

export type EnemyKind = 'grunt' | 'weaver' | 'tank';

export interface Enemy extends Vec {
  id: number;
  kind: EnemyKind;
  r: number;
  hp: number;
  maxHp: number;
  vx: number;
  vy: number;
  fireIn: number;
  phase: number;
  hitFlash: number;
  points: number;
}

export interface Projectile extends Vec {
  id: number;
  vx: number;
  vy: number;
  r: number;
  hostile: boolean;
  damage: number;
}

export interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
  size: number;
}

export interface Star extends Vec {
  z: number;
  size: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

export interface GameEvents {
  onShoot?: () => void;
  onExplode?: (big: boolean) => void;
  onHurt?: () => void;
  onWave?: (wave: number) => void;
  onGameOver?: (score: number) => void;
}

export interface Snapshot {
  phase: Phase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
}

const PLAYER_SPEED = 300; // px/s
const PLAYER_FIRE_INTERVAL = 0.16;
const BULLET_SPEED = 620;
const START_LIVES = 3;
const INVULN_TIME = 1.6;
const WAVE_LENGTH = 22; // seconds per wave

/** Deterministic small PRNG so tests are reproducible. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function circlesOverlap(a: Vec & { r: number }, b: Vec & { r: number }): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy <= rr * rr;
}

export class Game {
  phase: Phase = 'menu';
  score = 0;
  lives = START_LIVES;
  wave = 1;
  kills = 0;
  elapsed = 0;
  shake = 0;
  player: Player = { x: WORLD_W / 2, y: WORLD_H - 90, r: 13, cooldown: 0, invuln: 0, alive: true };
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  stars: Star[] = [];
  input: InputState = { up: false, down: false, left: false, right: false, fire: false };

  private spawnTimer = 0;
  private nextId = 1;
  private rng: () => number;
  private events: GameEvents;

  constructor(events: GameEvents = {}, seed = 0x9e3779b9) {
    this.events = events;
    this.rng = makeRng(seed);
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: this.rng() * WORLD_W,
        y: this.rng() * WORLD_H,
        z: 0.25 + this.rng() * 1.4,
        size: 0.6 + this.rng() * 1.7,
      });
    }
  }

  reset(): void {
    this.score = 0;
    this.lives = START_LIVES;
    this.wave = 1;
    this.kills = 0;
    this.elapsed = 0;
    this.shake = 0;
    this.spawnTimer = 0.4;
    this.player = { x: WORLD_W / 2, y: WORLD_H - 90, r: 13, cooldown: 0, invuln: 1.2, alive: true };
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.input = { up: false, down: false, left: false, right: false, fire: false };
  }

  start(): void {
    this.reset();
    this.phase = 'playing';
  }

  pause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'playing';
  }

  togglePause(): void {
    if (this.phase === 'playing') this.pause();
    else if (this.phase === 'paused') this.resume();
  }

  /** Difficulty multiplier that grows with elapsed time (escalating difficulty). */
  get difficulty(): number {
    return 1 + this.elapsed / 34;
  }

  snapshot(): Snapshot {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      playerX: Math.round(this.player.x),
      playerY: Math.round(this.player.y),
      enemyCount: this.enemies.length,
      projectileCount: this.projectiles.length,
    };
  }

  /** Force game over with an explicit score (used by the test adapter). */
  endGame(score?: number): void {
    if (typeof score === 'number' && Number.isFinite(score)) {
      this.score = Math.max(0, Math.floor(score));
    }
    this.lives = 0;
    this.phase = 'gameover';
    this.enemies = [];
    this.projectiles = [];
    this.events.onGameOver?.(this.score);
  }

  update(dtRaw: number): void {
    const dt = clamp(dtRaw, 0, 1 / 20);
    this.updateStars(dt);
    this.updateParticles(dt);
    if (this.phase !== 'playing') return;

    this.elapsed += dt;
    const newWave = Math.floor(this.elapsed / WAVE_LENGTH) + 1;
    if (newWave !== this.wave) {
      this.wave = newWave;
      this.events.onWave?.(this.wave);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);

    this.updatePlayer(dt);
    this.spawn(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.collide();
  }

  private updateStars(dt: number): void {
    for (const s of this.stars) {
      s.y += (18 + s.z * 62) * dt;
      if (s.y > WORLD_H) {
        s.y = -4;
        s.x = this.rng() * WORLD_W;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt;
      p.vy *= 1 - 1.6 * dt;
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    let dx = 0;
    let dy = 0;
    if (this.input.left) dx -= 1;
    if (this.input.right) dx += 1;
    if (this.input.up) dy -= 1;
    if (this.input.down) dy += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = Math.SQRT1_2;
      dx *= inv;
      dy *= inv;
    }
    p.x = clamp(p.x + dx * PLAYER_SPEED * dt, p.r + 4, WORLD_W - p.r - 4);
    p.y = clamp(p.y + dy * PLAYER_SPEED * dt, WORLD_H * 0.35, WORLD_H - p.r - 12);

    p.cooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;

    if (this.input.fire && p.cooldown <= 0) {
      p.cooldown = PLAYER_FIRE_INTERVAL;
      this.firePlayer();
    }
  }

  private firePlayer(): void {
    const p = this.player;
    const spread = this.wave >= 3 ? 1 : 0;
    this.projectiles.push(this.mkBullet(p.x, p.y - 16, 0, -BULLET_SPEED, false));
    if (spread) {
      this.projectiles.push(this.mkBullet(p.x - 9, p.y - 8, -70, -BULLET_SPEED * 0.94, false));
      this.projectiles.push(this.mkBullet(p.x + 9, p.y - 8, 70, -BULLET_SPEED * 0.94, false));
    }
    this.events.onShoot?.();
  }

  private mkBullet(x: number, y: number, vx: number, vy: number, hostile: boolean): Projectile {
    return { id: this.nextId++, x, y, vx, vy, r: hostile ? 5 : 3.5, hostile, damage: 1 };
  }

  private spawn(dt: number): void {
    this.spawnTimer -= dt * this.difficulty;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = Math.max(0.28, 1.15 - this.elapsed / 90) * (0.75 + this.rng() * 0.6);

    const roll = this.rng();
    let kind: EnemyKind = 'grunt';
    if (this.wave >= 2 && roll > 0.72) kind = 'weaver';
    if (this.wave >= 3 && roll > 0.92) kind = 'tank';

    const base = { x: 30 + this.rng() * (WORLD_W - 60), y: -30, phase: this.rng() * Math.PI * 2 };
    const d = this.difficulty;
    if (kind === 'grunt') {
      this.enemies.push({
        id: this.nextId++,
        kind,
        ...base,
        r: 14,
        hp: 1,
        maxHp: 1,
        vx: 0,
        vy: 70 * d,
        fireIn: 1.2 + this.rng() * 2.2,
        hitFlash: 0,
        points: 100,
      });
    } else if (kind === 'weaver') {
      this.enemies.push({
        id: this.nextId++,
        kind,
        ...base,
        r: 13,
        hp: 2,
        maxHp: 2,
        vx: 110,
        vy: 56 * d,
        fireIn: 1.0 + this.rng() * 1.6,
        hitFlash: 0,
        points: 175,
      });
    } else {
      this.enemies.push({
        id: this.nextId++,
        kind,
        ...base,
        r: 24,
        hp: 6 + Math.floor(this.wave / 2),
        maxHp: 6 + Math.floor(this.wave / 2),
        vx: 0,
        vy: 34 * d,
        fireIn: 1.4,
        hitFlash: 0,
        points: 450,
      });
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.phase += dt * 2.4;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.kind === 'weaver') {
        e.x += Math.cos(e.phase) * e.vx * dt;
      } else if (e.kind === 'tank') {
        e.x += Math.sin(e.phase * 0.5) * 26 * dt;
      }
      e.y += e.vy * dt;
      e.x = clamp(e.x, e.r, WORLD_W - e.r);

      e.fireIn -= dt;
      if (e.fireIn <= 0 && e.y > 0 && e.y < WORLD_H * 0.8) {
        e.fireIn = (e.kind === 'tank' ? 1.1 : 1.8 + this.rng() * 1.8) / this.difficulty;
        this.enemyShoot(e);
      }

      if (e.y - e.r > WORLD_H + 20) this.enemies.splice(i, 1);
    }
  }

  private enemyShoot(e: Enemy): void {
    const speed = 180 + this.difficulty * 34;
    if (e.kind === 'tank') {
      for (const a of [-0.34, 0, 0.34]) {
        this.projectiles.push(
          this.mkBullet(e.x, e.y + e.r, Math.sin(a) * speed, Math.cos(a) * speed, true),
        );
      }
      return;
    }
    const dx = this.player.x - e.x;
    const dy = this.player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    this.projectiles.push(
      this.mkBullet(e.x, e.y + e.r, (dx / len) * speed, (dy / len) * speed, true),
    );
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.y > WORLD_H + 30 || b.x < -30 || b.x > WORLD_W + 30) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private collide(): void {
    // Player bullets vs enemies
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      if (b.hostile) continue;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (!circlesOverlap(b, e)) continue;
        this.projectiles.splice(i, 1);
        e.hp -= b.damage;
        e.hitFlash = 0.12;
        this.burst(b.x, b.y, 6, e.kind === 'tank' ? 300 : 180, 1);
        if (e.hp <= 0) {
          this.enemies.splice(j, 1);
          this.kills += 1;
          this.score += Math.round(e.points * (1 + (this.wave - 1) * 0.15));
          this.burst(e.x, e.y, e.kind === 'tank' ? 34 : 16, e.kind === 'tank' ? 30 : 300, 2);
          this.shake = Math.min(1, this.shake + (e.kind === 'tank' ? 0.7 : 0.22));
          this.events.onExplode?.(e.kind === 'tank');
        }
        break;
      }
    }

    if (this.player.invuln > 0) {
      // still remove hostile bullets that would hit, but no damage
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const b = this.projectiles[i];
        if (b.hostile && circlesOverlap(b, this.player)) this.projectiles.splice(i, 1);
      }
      return;
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      if (!b.hostile) continue;
      if (circlesOverlap(b, this.player)) {
        this.projectiles.splice(i, 1);
        this.damagePlayer();
        return;
      }
    }

    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const e = this.enemies[j];
      if (circlesOverlap(e, this.player)) {
        this.enemies.splice(j, 1);
        this.burst(e.x, e.y, 20, 320, 2);
        this.damagePlayer();
        return;
      }
    }
  }

  private damagePlayer(): void {
    this.lives -= 1;
    this.player.invuln = INVULN_TIME;
    this.shake = 1;
    this.burst(this.player.x, this.player.y, 26, 190, 2);
    this.events.onHurt?.();
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = 'gameover';
      this.player.alive = false;
      this.events.onGameOver?.(this.score);
    } else {
      this.player.x = WORLD_W / 2;
      this.player.y = WORLD_H - 90;
    }
  }

  private burst(x: number, y: number, count: number, hue: number, power: number): void {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = (40 + this.rng() * 190) * power * 0.5;
      const life = 0.25 + this.rng() * 0.55;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        hue: hue + this.rng() * 40 - 20,
        size: 1 + this.rng() * 2.6 * power,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }
}

/** Shared name validation used by the UI (the DB enforces the same rules). */
export const NAME_PATTERN = /^[A-Za-z0-9 _\-.]{1,16}$/;

export function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = (raw ?? '').trim();
  if (name.length === 0) return { ok: false, error: 'Enter a name (1-16 characters).' };
  if (name.length > 16) return { ok: false, error: 'Name must be 16 characters or fewer.' };
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, error: 'Use letters, numbers, spaces, . _ - only.' };
  }
  return { ok: true, name };
}

export function validateScore(raw: number): boolean {
  return Number.isInteger(raw) && raw >= 0 && raw <= 10_000_000;
}
