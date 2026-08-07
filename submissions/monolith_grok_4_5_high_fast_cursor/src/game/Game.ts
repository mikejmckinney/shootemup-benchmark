import { AudioEngine } from './audio';
import { InputController } from './input';
import type {
  Enemy,
  GameStateSnapshot,
  Particle,
  Phase,
  Player,
  Projectile,
} from './types';

const WIDTH = 480;
const HEIGHT = 720;
const PLAYER_SPEED = 320;
const FIRE_COOLDOWN = 0.18;

export class Game {
  readonly width = WIDTH;
  readonly height = HEIGHT;
  readonly input = new InputController();
  readonly audio = new AudioEngine();

  phase: Phase = 'ready';
  score = 0;
  lives = 3;
  player: Player = this.createPlayer();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  spawnTimer = 0;
  elapsed = 0;
  shake = 0;
  flash = 0;
  private raf = 0;
  private lastTs = 0;
  private onChange: (() => void) | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.input.attach();
  }

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  mount(canvas: HTMLCanvasElement): void {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d');
    this.draw();
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

  async start(): Promise<void> {
    await this.audio.ensureStarted();
    this.resetRun();
    this.phase = 'playing';
    this.audio.start();
    this.notify();
    this.lastTs = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = (ts: number) => {
      const dt = Math.min(0.033, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      if (this.phase === 'playing') this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  endGameForTest(score: number): void {
    const safe = Math.max(0, Math.floor(score));
    this.score = safe;
    this.phase = 'gameover';
    this.enemies = [];
    this.projectiles = [];
    this.audio.gameOver();
    this.notify();
    this.draw();
  }

  private createPlayer(): Player {
    return {
      x: WIDTH / 2 - 18,
      y: HEIGHT - 90,
      w: 36,
      h: 40,
      cooldown: 0,
    };
  }

  private resetRun(): void {
    this.score = 0;
    this.lives = 3;
    this.player = this.createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.spawnTimer = 0.4;
    this.elapsed = 0;
    this.shake = 0;
    this.flash = 0;
    this.input.resetMovement();
  }

  private difficulty(): number {
    return 1 + this.elapsed / 35 + this.score / 2500;
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 8);
    this.flash = Math.max(0, this.flash - dt * 3);

    const p = this.player;
    const speed = PLAYER_SPEED * dt;
    if (this.input.state.left) p.x -= speed;
    if (this.input.state.right) p.x += speed;
    if (this.input.state.up) p.y -= speed;
    if (this.input.state.down) p.y += speed;
    p.x = Math.max(8, Math.min(WIDTH - p.w - 8, p.x));
    p.y = Math.max(HEIGHT * 0.45, Math.min(HEIGHT - p.h - 16, p.y));

    p.cooldown = Math.max(0, p.cooldown - dt);
    if (this.input.state.fire && p.cooldown <= 0) {
      this.projectiles.push({
        x: p.x + p.w / 2 - 3,
        y: p.y - 8,
        w: 6,
        h: 14,
        vy: -620,
        fromPlayer: true,
      });
      p.cooldown = Math.max(0.08, FIRE_COOLDOWN - this.difficulty() * 0.01);
      this.audio.shoot();
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = Math.max(0.28, 1.15 / this.difficulty());
    }

    for (const e of this.enemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 8 || e.x + e.w > WIDTH - 8) e.vx *= -1;
      if (e.kind === 'raider' && Math.random() < 0.008 * this.difficulty()) {
        this.projectiles.push({
          x: e.x + e.w / 2 - 3,
          y: e.y + e.h,
          w: 6,
          h: 12,
          vy: 280 + this.difficulty() * 20,
          fromPlayer: false,
        });
      }
    }

    for (const pr of this.projectiles) {
      pr.y += pr.vy * dt;
    }

    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      pt.vy += 40 * dt;
    }

    this.resolveCollisions();

    this.enemies = this.enemies.filter((e) => e.y < HEIGHT + 40 && e.hp > 0);
    this.projectiles = this.projectiles.filter((pr) => pr.y > -40 && pr.y < HEIGHT + 40);
    this.particles = this.particles.filter((pt) => pt.life > 0);

    this.notify();
  }

  private spawnEnemy(): void {
    const hard = Math.random() < Math.min(0.45, 0.12 * this.difficulty());
    const w = hard ? 40 : 28;
    const h = hard ? 34 : 26;
    this.enemies.push({
      x: 20 + Math.random() * (WIDTH - w - 40),
      y: -h - 10,
      w,
      h,
      vx: (Math.random() * 2 - 1) * (40 + this.difficulty() * 18),
      vy: 70 + this.difficulty() * 28 + Math.random() * 40,
      hp: hard ? 2 : 1,
      kind: hard ? 'raider' : 'drone',
    });
  }

  private overlaps(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private burst(x: number, y: number, color: string, n = 10): void {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.3 + Math.random() * 0.45,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private playerHit(): void {
    this.lives -= 1;
    this.shake = 0.35;
    this.flash = 0.4;
    this.audio.hit();
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ff6b9d', 14);
    this.player.x = WIDTH / 2 - this.player.w / 2;
    this.player.y = HEIGHT - 90;
    this.projectiles = this.projectiles.filter((p) => p.fromPlayer);
    if (this.lives <= 0) {
      this.phase = 'gameover';
      this.audio.gameOver();
    }
  }

  private resolveCollisions(): void {
    for (const pr of this.projectiles) {
      if (!pr.fromPlayer) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (this.overlaps(pr, e)) {
          pr.y = -9999;
          e.hp -= 1;
          if (e.hp <= 0) {
            this.score += e.kind === 'raider' ? 150 : 75;
            this.audio.explosion();
            this.burst(e.x + e.w / 2, e.y + e.h / 2, e.kind === 'raider' ? '#ff4d6d' : '#39ffc4');
          } else {
            this.burst(e.x + e.w / 2, e.y + e.h / 2, '#ffe566', 5);
          }
        }
      }
    }

    for (const pr of this.projectiles) {
      if (pr.fromPlayer) continue;
      if (this.overlaps(pr, this.player)) {
        pr.y = -9999;
        this.playerHit();
        if (this.phase !== 'playing') return;
      }
    }

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (this.overlaps(e, this.player)) {
        e.hp = 0;
        this.playerHit();
        if (this.phase !== 'playing') return;
      }
      if (e.y + e.h >= HEIGHT) {
        e.hp = 0;
        this.playerHit();
        if (this.phase !== 'playing') return;
      }
    }
  }

  private notify(): void {
    this.onChange?.();
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 8 * this.shake, (Math.random() - 0.5) * 8 * this.shake);
    }

    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#070b1a');
    g.addColorStop(0.55, '#101935');
    g.addColorStop(1, '#1a0f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // starfield / scanlines atmosphere
    ctx.fillStyle = 'rgba(120, 220, 255, 0.35)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + this.elapsed * 20) % WIDTH;
      const y = (i * 53 + this.elapsed * (30 + (i % 5) * 12)) % HEIGHT;
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = 'rgba(57, 255, 196, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < HEIGHT; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y + ((this.elapsed * 40) % 28));
      ctx.lineTo(WIDTH, y + ((this.elapsed * 40) % 28));
      ctx.stroke();
    }

    for (const pr of this.projectiles) {
      ctx.fillStyle = pr.fromPlayer ? '#7cf9ff' : '#ff5f8a';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
      ctx.shadowBlur = 0;
    }

    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    this.drawPlayer(ctx);

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1;
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 90, 140, ${this.flash * 0.35})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    if (this.phase === 'ready') {
      this.drawBanner(ctx, 'NEON BARRAGE', 'Press START to engage');
    } else if (this.phase === 'gameover') {
      this.drawBanner(ctx, 'SIGNAL LOST', `Final score ${this.score}`);
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const cx = p.x + p.w / 2;
    ctx.save();
    ctx.translate(cx, p.y + p.h / 2);
    ctx.shadowColor = '#39ffc4';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#39ffc4';
    ctx.beginPath();
    ctx.moveTo(0, -p.h / 2);
    ctx.lineTo(p.w / 2, p.h / 2);
    ctx.lineTo(0, p.h / 3);
    ctx.lineTo(-p.w / 2, p.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dffcff';
    ctx.fillRect(-3, -4, 6, 10);
    // thruster
    ctx.fillStyle = `rgba(255, 180, 80, ${0.5 + Math.sin(this.elapsed * 30) * 0.3})`;
    ctx.fillRect(-4, p.h / 2 - 2, 8, 10 + Math.random() * 6);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.shadowBlur = 12;
    if (e.kind === 'raider') {
      ctx.shadowColor = '#ff4d6d';
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.moveTo(0, e.h / 2);
      ctx.lineTo(e.w / 2, -e.h / 2);
      ctx.lineTo(0, -e.h / 4);
      ctx.lineTo(-e.w / 2, -e.h / 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.shadowColor = '#c77dff';
      ctx.fillStyle = '#c77dff';
      ctx.beginPath();
      ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1240';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBanner(ctx: CanvasRenderingContext2D, title: string, subtitle: string): void {
    ctx.fillStyle = 'rgba(4, 8, 20, 0.55)';
    ctx.fillRect(0, HEIGHT * 0.32, WIDTH, 120);
    ctx.fillStyle = '#7cf9ff';
    ctx.font = 'bold 34px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, WIDTH / 2, HEIGHT * 0.32 + 48);
    ctx.fillStyle = '#d7e7ff';
    ctx.font = '16px "Rajdhani", sans-serif';
    ctx.fillText(subtitle, WIDTH / 2, HEIGHT * 0.32 + 84);
  }
}
