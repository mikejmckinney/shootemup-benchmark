export type GamePhase = "ready" | "playing" | "gameover";

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

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
}

export interface GameSnapshot {
  phase: GamePhase;
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

const W = 800;
const H = 600;

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export class NeonBarrageGame {
  readonly width = W;
  readonly height = H;

  phase: GamePhase = "ready";
  score = 0;
  lives = 3;
  player: Entity = { x: W / 2 - 16, y: H - 64, w: 32, h: 32, vx: 0, vy: 0, alive: true };
  enemies: Entity[] = [];
  projectiles: Entity[] = [];
  enemyShots: Entity[] = [];
  particles: Particle[] = [];
  spawnTimer = 0;
  fireCooldown = 0;
  invuln = 0;
  elapsed = 0;
  shake = 0;
  starField: Array<{ x: number; y: number; s: number; speed: number }> = [];

  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onPhase?: (phase: GamePhase) => void;
  onSfx?: (kind: "shoot" | "hit" | "explode" | "hurt" | "start" | "gameover") => void;

  constructor() {
    for (let i = 0; i < 60; i++) {
      this.starField.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 0.6 + Math.random() * 2.2,
        speed: 20 + Math.random() * 90,
      });
    }
  }

  reset(): void {
    this.phase = "ready";
    this.score = 0;
    this.lives = 3;
    this.player = { x: W / 2 - 16, y: H - 64, w: 32, h: 32, vx: 0, vy: 0, alive: true };
    this.enemies = [];
    this.projectiles = [];
    this.enemyShots = [];
    this.particles = [];
    this.spawnTimer = 0;
    this.fireCooldown = 0;
    this.invuln = 0;
    this.elapsed = 0;
    this.shake = 0;
    this.onScore?.(this.score);
    this.onLives?.(this.lives);
    this.onPhase?.(this.phase);
  }

  start(): void {
    this.reset();
    this.phase = "playing";
    this.onPhase?.(this.phase);
    this.onSfx?.("start");
  }

  endGame(score?: number): void {
    if (typeof score === "number" && Number.isFinite(score) && score >= 0) {
      this.score = Math.floor(score);
      this.onScore?.(this.score);
    }
    this.phase = "gameover";
    this.player.alive = false;
    this.onPhase?.(this.phase);
    this.onSfx?.("gameover");
  }

  getState(): GameSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      playerX: this.player.x,
      playerY: this.player.y,
      enemyCount: this.enemies.filter((e) => e.alive).length,
      projectileCount:
        this.projectiles.filter((p) => p.alive).length +
        this.enemyShots.filter((p) => p.alive).length,
    };
  }

  private difficulty(): number {
    return 1 + this.elapsed / 25 + this.score / 800;
  }

  private burst(x: number, y: number, color: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        w: 3,
        h: 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alive: true,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color,
      });
    }
  }

  private spawnEnemy(): void {
    const d = this.difficulty();
    const kind = Math.random();
    const w = kind > 0.7 ? 36 : 26;
    const h = kind > 0.7 ? 28 : 22;
    this.enemies.push({
      x: 20 + Math.random() * (W - 40 - w),
      y: -40,
      w,
      h,
      vx: (Math.random() - 0.5) * (40 + d * 20),
      vy: 50 + Math.random() * (40 + d * 35),
      alive: true,
    });
  }

  update(dt: number, input: InputState): void {
    if (this.phase !== "playing") {
      for (const star of this.starField) {
        star.y += star.speed * dt * 0.35;
        if (star.y > H) {
          star.y = 0;
          star.x = Math.random() * W;
        }
      }
      return;
    }

    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 8);
    this.invuln = Math.max(0, this.invuln - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    const speed = 280;
    this.player.vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    this.player.vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(this.player.vx, this.player.vy) || 1;
    this.player.x = clamp(this.player.x + (this.player.vx / len) * speed * dt, 0, W - this.player.w);
    this.player.y = clamp(this.player.y + (this.player.vy / len) * speed * dt, 0, H - this.player.h);

    if (input.fire && this.fireCooldown <= 0) {
      this.projectiles.push({
        x: this.player.x + this.player.w / 2 - 3,
        y: this.player.y - 8,
        w: 6,
        h: 14,
        vx: 0,
        vy: -520,
        alive: true,
      });
      this.fireCooldown = Math.max(0.12, 0.22 - this.difficulty() * 0.01);
      this.onSfx?.("shoot");
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      this.spawnTimer = Math.max(0.28, 1.1 - this.difficulty() * 0.12);
    }

    for (const star of this.starField) {
      star.y += star.speed * dt;
      if (star.y > H) {
        star.y = 0;
        star.x = Math.random() * W;
      }
    }

    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.y += p.vy * dt;
      if (p.y + p.h < 0) p.alive = false;
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < 0 || e.x + e.w > W) e.vx *= -1;
      if (e.y > H + 40) e.alive = false;
      if (Math.random() < 0.004 * this.difficulty()) {
        this.enemyShots.push({
          x: e.x + e.w / 2 - 3,
          y: e.y + e.h,
          w: 6,
          h: 12,
          vx: 0,
          vy: 180 + this.difficulty() * 40,
          alive: true,
        });
      }
    }

    for (const s of this.enemyShots) {
      if (!s.alive) continue;
      s.y += s.vy * dt;
      if (s.y > H) s.alive = false;
    }

    for (const p of this.particles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }

    for (const p of this.projectiles) {
      if (!p.alive) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(p, e)) {
          p.alive = false;
          e.alive = false;
          this.score += e.w > 30 ? 150 : 100;
          this.onScore?.(this.score);
          this.burst(e.x + e.w / 2, e.y + e.h / 2, e.w > 30 ? "#ff2bd6" : "#33f6ff", 14);
          this.shake = 0.18;
          this.onSfx?.("explode");
          break;
        }
      }
    }

    if (this.invuln <= 0 && this.player.alive) {
      const hit =
        this.enemies.some((e) => e.alive && rectsOverlap(this.player, e)) ||
        this.enemyShots.some((s) => s.alive && rectsOverlap(this.player, s));
      if (hit) {
        this.lives -= 1;
        this.onLives?.(this.lives);
        this.invuln = 1.25;
        this.shake = 0.35;
        this.burst(this.player.x + 16, this.player.y + 16, "#ff4d6d", 18);
        this.onSfx?.("hurt");
        this.enemyShots.forEach((s) => {
          if (rectsOverlap(this.player, s)) s.alive = false;
        });
        if (this.lives <= 0) {
          this.endGame();
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.enemyShots = this.enemyShots.filter((s) => s.alive);
    this.particles = this.particles.filter((p) => p.alive);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 8 * this.shake, (Math.random() - 0.5) * 8 * this.shake);
    }

    ctx.clearRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, W, H);

    for (const star of this.starField) {
      ctx.globalAlpha = 0.35 + star.s / 4;
      ctx.fillStyle = "#9adfff";
      ctx.fillRect(star.x, star.y, star.s, star.s * 2);
    }
    ctx.globalAlpha = 1;

    // scanlines
    ctx.fillStyle = "rgba(51,246,255,0.03)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

    if (this.player.alive && (this.invuln <= 0 || Math.floor(this.invuln * 20) % 2 === 0)) {
      const px = this.player.x;
      const py = this.player.y;
      const g = ctx.createLinearGradient(px, py, px, py + 32);
      g.addColorStop(0, "#b8ff3d");
      g.addColorStop(1, "#33f6ff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px + 16, py);
      ctx.lineTo(px + 32, py + 28);
      ctx.lineTo(px + 16, py + 22);
      ctx.lineTo(px, py + 28);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = "#33f6ff";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const p of this.projectiles) {
      ctx.fillStyle = "#b8ff3d";
      ctx.shadowColor = "#b8ff3d";
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.shadowBlur = 0;
    }

    for (const s of this.enemyShots) {
      ctx.fillStyle = "#ff4d6d";
      ctx.shadowColor = "#ff4d6d";
      ctx.shadowBlur = 8;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.shadowBlur = 0;
    }

    for (const e of this.enemies) {
      const g = ctx.createLinearGradient(e.x, e.y, e.x, e.y + e.h);
      g.addColorStop(0, e.w > 30 ? "#ff7ad9" : "#66f0ff");
      g.addColorStop(1, e.w > 30 ? "#ff2bd6" : "#1a8cff");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y + e.h);
      ctx.lineTo(e.x + e.w, e.y);
      ctx.lineTo(e.x + e.w * 0.7, e.y + e.h * 0.35);
      ctx.lineTo(e.x + e.w * 0.3, e.y + e.h * 0.35);
      ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export { rectsOverlap, clamp };
