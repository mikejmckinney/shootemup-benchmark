/**
 * Neon Barrage — headless game simulation.
 * Contains zero DOM/canvas access so it can be unit-tested in Node.
 */

export const WORLD = { w: 480, h: 720 };

export type Phase = 'idle' | 'playing' | 'gameover';

export interface Vec {
  x: number;
  y: number;
}

export interface Projectile extends Vec {
  vx: number;
  vy: number;
  hostile: boolean;
  r: number;
}

export type EnemyKind = 'drone' | 'weaver' | 'brute';

export interface Enemy extends Vec {
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  kind: EnemyKind;
  points: number;
  fireCooldown: number;
  phase: number;
  hitFlash: number;
}

export interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Star extends Vec {
  speed: number;
  size: number;
}

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

export type GameEvent =
  | { type: 'shoot' }
  | { type: 'hit' }
  | { type: 'explosion' }
  | { type: 'playerHit' }
  | { type: 'gameover' }
  | { type: 'wave'; wave: number };

const PLAYER_SPEED = 260;
const PLAYER_R = 13;
const SHOT_COOLDOWN = 0.17;
const INVULN_TIME = 1.8;

let seed = 0x2f6e2b1;
function rnd(): number {
  // deterministic xorshift keeps unit tests stable
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 0xffffffff;
}
export function reseed(s: number): void {
  seed = s >>> 0 || 1;
}

export class Game {
  phase: Phase = 'idle';
  score = 0;
  lives = 3;
  wave = 1;
  player: Vec = { x: WORLD.w / 2, y: WORLD.h - 90 };
  projectiles: Projectile[] = [];
  enemies: Enemy[] = [];
  particles: Particle[] = [];
  stars: Star[] = [];
  events: GameEvent[] = [];
  shake = 0;
  invuln = 0;
  elapsed = 0;

  private shotTimer = 0;
  private spawnTimer = 0;
  private waveTimer = 0;

  constructor() {
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: rnd() * WORLD.w,
        y: rnd() * WORLD.h,
        speed: 12 + rnd() * 70,
        size: rnd() < 0.8 ? 1 : 2,
      });
    }
  }

  start(): void {
    this.phase = 'playing';
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.elapsed = 0;
    this.player = { x: WORLD.w / 2, y: WORLD.h - 90 };
    this.projectiles = [];
    this.enemies = [];
    this.particles = [];
    this.shotTimer = 0;
    this.spawnTimer = 0.4;
    this.waveTimer = 0;
    this.invuln = INVULN_TIME;
    this.shake = 0;
  }

  /** Force game-over (used by the test adapter and by losing all lives). */
  endGame(score?: number): void {
    if (typeof score === 'number' && Number.isFinite(score)) {
      this.score = Math.max(0, Math.floor(score));
    }
    if (this.phase !== 'gameover') {
      this.phase = 'gameover';
      this.lives = 0;
      this.events.push({ type: 'gameover' });
    }
  }

  get difficulty(): number {
    return 1 + (this.wave - 1) * 0.18;
  }

  update(dt: number, input: Input): void {
    dt = Math.min(dt, 0.05);
    for (const s of this.stars) {
      s.y += s.speed * dt * (this.phase === 'playing' ? 1 : 0.35);
      if (s.y > WORLD.h) {
        s.y = -2;
        s.x = rnd() * WORLD.w;
      }
    }
    this.shake = Math.max(0, this.shake - dt * 60);
    this.stepParticles(dt);

    if (this.phase !== 'playing') return;

    this.elapsed += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.waveTimer += dt;
    if (this.waveTimer > 18) {
      this.waveTimer = 0;
      this.wave++;
      this.events.push({ type: 'wave', wave: this.wave });
    }

    // player movement
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    this.player.x += (dx / len) * PLAYER_SPEED * dt;
    this.player.y += (dy / len) * PLAYER_SPEED * dt;
    this.player.x = clamp(this.player.x, PLAYER_R, WORLD.w - PLAYER_R);
    this.player.y = clamp(this.player.y, WORLD.h * 0.35, WORLD.h - PLAYER_R - 8);

    // firing
    this.shotTimer -= dt;
    if (input.fire && this.shotTimer <= 0) {
      this.shotTimer = SHOT_COOLDOWN;
      const spread = this.wave >= 4 ? 1 : 0;
      this.projectiles.push(bullet(this.player.x, this.player.y - 16, 0, -560));
      if (spread) {
        this.projectiles.push(bullet(this.player.x - 9, this.player.y - 8, -80, -540));
        this.projectiles.push(bullet(this.player.x + 9, this.player.y - 8, 80, -540));
      }
      this.events.push({ type: 'shoot' });
    }

    // spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.34, 1.35 - this.wave * 0.09);
      this.spawnEnemy();
    }

    this.stepProjectiles(dt);
    this.stepEnemies(dt);
    this.resolveCollisions();
  }

  private spawnEnemy(): void {
    const roll = rnd();
    let kind: EnemyKind = 'drone';
    if (this.wave >= 2 && roll > 0.65) kind = 'weaver';
    if (this.wave >= 3 && roll > 0.9) kind = 'brute';
    const d = this.difficulty;
    const base = { x: 30 + rnd() * (WORLD.w - 60), y: -30, phase: rnd() * Math.PI * 2, hitFlash: 0 };
    if (kind === 'brute') {
      this.enemies.push({
        ...base,
        vx: 0,
        vy: 42 * d,
        r: 22,
        hp: 6,
        maxHp: 6,
        kind,
        points: 250,
        fireCooldown: 1.4,
      });
    } else if (kind === 'weaver') {
      this.enemies.push({
        ...base,
        vx: 90,
        vy: 72 * d,
        r: 14,
        hp: 2,
        maxHp: 2,
        kind,
        points: 120,
        fireCooldown: 1.9,
      });
    } else {
      this.enemies.push({
        ...base,
        vx: 0,
        vy: 92 * d,
        r: 13,
        hp: 1,
        maxHp: 1,
        kind,
        points: 60,
        fireCooldown: 2.6,
      });
    }
  }

  private stepProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.projectiles = this.projectiles.filter(
      (p) => p.y > -30 && p.y < WORLD.h + 30 && p.x > -30 && p.x < WORLD.w + 30,
    );
  }

  private stepEnemies(dt: number): void {
    for (const e of this.enemies) {
      e.phase += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
      e.y += e.vy * dt;
      if (e.kind === 'weaver') {
        e.x += Math.cos(e.phase * 2.2) * e.vx * dt * 2;
      }
      e.x = clamp(e.x, e.r, WORLD.w - e.r);
      e.fireCooldown -= dt * this.difficulty;
      if (e.fireCooldown <= 0 && e.y > 20 && e.y < WORLD.h * 0.75) {
        e.fireCooldown = 1.6 + rnd() * 2.2;
        const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        const sp = 165 + this.wave * 8;
        this.projectiles.push({
          x: e.x,
          y: e.y + e.r,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          hostile: true,
          r: 4.5,
        });
      }
    }
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((e) => e.y < WORLD.h + 40);
    if (this.enemies.length < before) {
      /* escaped enemies simply despawn */
    }
  }

  private resolveCollisions(): void {
    const deadProjectiles = new Set<Projectile>();
    for (const p of this.projectiles) {
      if (p.hostile) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(p, e) < (p.r + e.r) ** 2) {
          e.hp -= 1;
          e.hitFlash = 1;
          deadProjectiles.add(p);
          this.events.push({ type: 'hit' });
          this.burst(p.x, p.y, 5, '#7df9ff', 90);
          if (e.hp <= 0) {
            this.score += Math.round(e.points * (1 + (this.wave - 1) * 0.1));
            this.burst(e.x, e.y, 22, e.kind === 'brute' ? '#ff4d9d' : '#b06bff', 200);
            this.shake = Math.min(14, this.shake + (e.kind === 'brute' ? 12 : 5));
            this.events.push({ type: 'explosion' });
          }
          break;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.projectiles = this.projectiles.filter((p) => !deadProjectiles.has(p));

    if (this.invuln > 0) return;

    let hurt = false;
    for (const p of this.projectiles) {
      if (p.hostile && dist2(p, this.player) < (p.r + PLAYER_R) ** 2) {
        hurt = true;
        deadProjectiles.add(p);
        break;
      }
    }
    if (!hurt) {
      for (const e of this.enemies) {
        if (dist2(e, this.player) < (e.r + PLAYER_R) ** 2) {
          hurt = true;
          e.hp = 0;
          break;
        }
      }
      this.enemies = this.enemies.filter((e) => e.hp > 0);
    }
    if (hurt) {
      this.projectiles = this.projectiles.filter((p) => !deadProjectiles.has(p));
      this.lives -= 1;
      this.invuln = INVULN_TIME;
      this.shake = 18;
      this.burst(this.player.x, this.player.y, 30, '#ff4d6d', 220);
      this.events.push({ type: 'playerHit' });
      if (this.lives <= 0) {
        this.lives = 0;
        this.phase = 'gameover';
        this.events.push({ type: 'gameover' });
      }
    }
  }

  burst(x: number, y: number, n: number, color: string, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const s = speed * (0.25 + rnd() * 0.75);
      const life = 0.3 + rnd() * 0.6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        color,
        size: 1 + rnd() * 2.5,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  private stepParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  snapshot() {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      playerX: Math.round(this.player.x * 100) / 100,
      playerY: Math.round(this.player.y * 100) / 100,
      enemyCount: this.enemies.length,
      projectileCount: this.projectiles.length,
    };
  }
}

function bullet(x: number, y: number, vx: number, vy: number): Projectile {
  return { x, y, vx, vy, hostile: false, r: 4 };
}
function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
function dist2(a: Vec, b: Vec): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** Shared name validation — mirrors the database CHECK constraints. */
export const NAME_RE = /^[A-Za-z0-9 _.\-]{1,16}$/;
export function validateName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = (raw ?? '').trim();
  if (name.length === 0) return { ok: false, error: 'Enter a name (1-16 characters).' };
  if (name.length > 16) return { ok: false, error: 'Name must be 16 characters or fewer.' };
  if (!NAME_RE.test(name))
    return { ok: false, error: 'Use letters, numbers, spaces, _ . or - only.' };
  return { ok: true, name };
}

export function validateScore(raw: number): boolean {
  return Number.isInteger(raw) && raw >= 0 && raw <= 10_000_000;
}
