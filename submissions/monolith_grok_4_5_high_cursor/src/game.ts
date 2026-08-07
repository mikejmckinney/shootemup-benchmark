export type Phase = 'ready' | 'playing' | 'gameover';

export type GameStateSnapshot = {
  phase: Phase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
};

type Vec = { x: number; y: number };

type Player = Vec & { w: number; h: number; cooldown: number; invuln: number };

type Enemy = Vec & {
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  kind: 'drone' | 'heavy';
  pulse: number;
};

type Projectile = Vec & {
  w: number;
  h: number;
  vy: number;
  from: 'player' | 'enemy';
};

type Particle = Vec & {
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

type Star = Vec & { speed: number; size: number; alpha: number };

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
};

export type GameCallbacks = {
  onHud?: (score: number, lives: number) => void;
  onPhase?: (phase: Phase) => void;
  onShoot?: () => void;
  onExplosion?: () => void;
  onHit?: () => void;
  onGameOver?: () => void;
};

const WIDTH = 480;
const HEIGHT = 720;
const PLAYER_SPEED = 280;
const FIRE_COOLDOWN = 0.18;

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class NeonBarrageGame {
  readonly width = WIDTH;
  readonly height = HEIGHT;

  phase: Phase = 'ready';
  score = 0;
  lives = 3;

  private player: Player;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];
  private spawnTimer = 0;
  private elapsed = 0;
  private flash = 0;
  private callbacks: GameCallbacks;
  private shake = 0;

  constructor(callbacks: GameCallbacks = {}) {
    this.callbacks = callbacks;
    this.player = this.createPlayer();
    this.stars = this.createStars();
  }

  private createPlayer(): Player {
    return {
      x: WIDTH / 2 - 14,
      y: HEIGHT - 90,
      w: 28,
      h: 28,
      cooldown: 0,
      invuln: 0,
    };
  }

  private createStars(): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        speed: 20 + Math.random() * 90,
        size: 1 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.7,
      });
    }
    return stars;
  }

  getSnapshot(): GameStateSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      playerX: this.player.x,
      playerY: this.player.y,
      enemyCount: this.enemies.length,
      projectileCount: this.projectiles.length,
    };
  }

  start(): void {
    this.phase = 'playing';
    this.score = 0;
    this.lives = 3;
    this.player = this.createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.spawnTimer = 0.4;
    this.elapsed = 0;
    this.flash = 0;
    this.shake = 0;
    this.callbacks.onHud?.(this.score, this.lives);
    this.callbacks.onPhase?.(this.phase);
  }

  endGameForTest(score: number): void {
    const safeScore = Math.max(0, Math.floor(score));
    this.score = safeScore;
    this.lives = 0;
    this.phase = 'gameover';
    this.enemies = [];
    this.projectiles = [];
    this.callbacks.onHud?.(this.score, this.lives);
    this.callbacks.onPhase?.(this.phase);
    this.callbacks.onGameOver?.();
  }

  private difficulty(): number {
    return 1 + this.elapsed / 35 + this.score / 1200;
  }

  private spawnEnemy(): void {
    const d = this.difficulty();
    const heavy = Math.random() < Math.min(0.35, 0.08 + d * 0.04);
    const w = heavy ? 36 : 24;
    const h = heavy ? 30 : 22;
    this.enemies.push({
      x: 20 + Math.random() * (WIDTH - 40 - w),
      y: -h - 10,
      w,
      h,
      vx: (Math.random() - 0.5) * (40 + d * 20),
      vy: (heavy ? 45 : 70) + d * 18 + Math.random() * 30,
      hp: heavy ? 3 : 1,
      kind: heavy ? 'heavy' : 'drone',
      pulse: Math.random() * Math.PI * 2,
    });
  }

  private burst(x: number, y: number, color: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.45,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  private loseLife(): void {
    if (this.player.invuln > 0) return;
    this.lives -= 1;
    this.player.invuln = 1.4;
    this.flash = 0.25;
    this.shake = 0.35;
    this.callbacks.onHit?.();
    this.callbacks.onHud?.(this.score, this.lives);
    if (this.lives <= 0) {
      this.phase = 'gameover';
      this.callbacks.onPhase?.(this.phase);
      this.callbacks.onGameOver?.();
    }
  }

  update(dt: number, input: InputState): void {
    if (this.phase !== 'playing') {
      this.updateDecor(dt * 0.4);
      return;
    }

    this.elapsed += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.updateDecor(dt);

    const p = this.player;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    let mx = 0;
    let my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my) || 1;
      p.x += (mx / len) * PLAYER_SPEED * dt;
      p.y += (my / len) * PLAYER_SPEED * dt;
    }
    p.x = Math.max(8, Math.min(WIDTH - p.w - 8, p.x));
    p.y = Math.max(40, Math.min(HEIGHT - p.h - 16, p.y));

    if (input.fire && p.cooldown <= 0) {
      this.projectiles.push({
        x: p.x + p.w / 2 - 2,
        y: p.y - 8,
        w: 4,
        h: 14,
        vy: -520,
        from: 'player',
      });
      p.cooldown = Math.max(0.1, FIRE_COOLDOWN - this.difficulty() * 0.01);
      this.callbacks.onShoot?.();
    }

    this.spawnTimer -= dt;
    const spawnInterval = Math.max(0.28, 1.1 - this.difficulty() * 0.12);
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      if (this.difficulty() > 2.2 && Math.random() < 0.35) this.spawnEnemy();
      this.spawnTimer = spawnInterval;
    }

    for (const e of this.enemies) {
      e.pulse += dt * 4;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 8 || e.x + e.w > WIDTH - 8) e.vx *= -1;
      if (e.kind === 'heavy' && Math.random() < dt * (0.35 + this.difficulty() * 0.1)) {
        this.projectiles.push({
          x: e.x + e.w / 2 - 3,
          y: e.y + e.h,
          w: 6,
          h: 10,
          vy: 180 + this.difficulty() * 25,
          from: 'enemy',
        });
      }
    }

    for (const pr of this.projectiles) {
      pr.y += pr.vy * dt;
    }

    // collisions: player shots vs enemies
    for (const pr of this.projectiles) {
      if (pr.from !== 'player') continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (rectsOverlap(pr, e)) {
          pr.y = -9999;
          e.hp -= 1;
          this.burst(pr.x, pr.y, '#7ef9ff', 4);
          if (e.hp <= 0) {
            this.score += e.kind === 'heavy' ? 150 : 50;
            this.burst(e.x + e.w / 2, e.y + e.h / 2, e.kind === 'heavy' ? '#ff7ad9' : '#9d7cff', 14);
            this.callbacks.onExplosion?.();
            this.callbacks.onHud?.(this.score, this.lives);
          }
        }
      }
    }

    // enemy shots / bodies vs player
    if (p.invuln <= 0) {
      for (const pr of this.projectiles) {
        if (pr.from === 'enemy' && rectsOverlap(pr, p)) {
          pr.y = HEIGHT + 100;
          this.loseLife();
          break;
        }
      }
      for (const e of this.enemies) {
        if (e.hp > 0 && rectsOverlap(e, p)) {
          e.hp = 0;
          this.burst(e.x + e.w / 2, e.y + e.h / 2, '#ff5e7a', 12);
          this.loseLife();
          break;
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.y < HEIGHT + 40);
    this.projectiles = this.projectiles.filter((pr) => pr.y > -40 && pr.y < HEIGHT + 40);

    for (const part of this.particles) {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.life -= dt;
      part.vx *= 0.98;
      part.vy *= 0.98;
    }
    this.particles = this.particles.filter((part) => part.life > 0);
  }

  private updateDecor(dt: number): void {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > HEIGHT) {
        s.y = -2;
        s.x = Math.random() * WIDTH;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    }

    const grd = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grd.addColorStop(0, '#07061a');
    grd.addColorStop(0.55, '#101038');
    grd.addColorStop(1, '#1a0b2e');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#c9d4ff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // grid floor glow
    ctx.strokeStyle = 'rgba(80, 255, 220, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    if (this.phase !== 'ready') {
      this.drawPlayer(ctx);
      for (const e of this.enemies) this.drawEnemy(ctx, e);
      for (const pr of this.projectiles) this.drawProjectile(ctx, pr);
      for (const part of this.particles) {
        ctx.globalAlpha = Math.max(0, part.life * 2);
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 80, 120, ${this.flash})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    if (this.phase === 'ready') {
      this.drawBanner(ctx, 'NEON BARRAGE', 'Press Start — clear the neon swarm');
    } else if (this.phase === 'gameover') {
      this.drawBanner(ctx, 'SIGNAL LOST', `Final score ${this.score}`);
    }

    ctx.restore();
  }

  private drawBanner(ctx: CanvasRenderingContext2D, title: string, sub: string): void {
    ctx.fillStyle = 'rgba(4, 6, 20, 0.55)';
    ctx.fillRect(30, HEIGHT / 2 - 70, WIDTH - 60, 140);
    ctx.strokeStyle = 'rgba(120, 255, 230, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, HEIGHT / 2 - 70, WIDTH - 60, 140);
    ctx.fillStyle = '#7ef9ff';
    ctx.font = 'bold 28px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 10);
    ctx.fillStyle = '#d7c7ff';
    ctx.font = '14px Rajdhani, sans-serif';
    ctx.fillText(sub, WIDTH / 2, HEIGHT / 2 + 24);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return;
    const cx = p.x + p.w / 2;
    ctx.save();
    ctx.shadowColor = '#48f7ff';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#48f7ff';
    ctx.beginPath();
    ctx.moveTo(cx, p.y);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.lineTo(cx, p.y + p.h - 8);
    ctx.lineTo(p.x, p.y + p.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9d7cff';
    ctx.fillRect(cx - 3, p.y + 10, 6, 10);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const pulse = 0.85 + Math.sin(e.pulse) * 0.15;
    ctx.save();
    ctx.shadowColor = e.kind === 'heavy' ? '#ff7ad9' : '#b388ff';
    ctx.shadowBlur = 12;
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = e.kind === 'heavy' ? '#ff4fa3' : '#8b5cff';
    ctx.beginPath();
    ctx.moveTo(0, -e.h / 2);
    ctx.lineTo(e.w / 2, 0);
    ctx.lineTo(0, e.h / 2);
    ctx.lineTo(-e.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile): void {
    ctx.save();
    ctx.shadowBlur = 10;
    if (pr.from === 'player') {
      ctx.shadowColor = '#7ef9ff';
      ctx.fillStyle = '#b8fff7';
    } else {
      ctx.shadowColor = '#ff7ad9';
      ctx.fillStyle = '#ff9ad8';
    }
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    ctx.restore();
  }
}
