import type { Enemy, GamePhase, GameStateSnapshot, Particle, Player, Projectile } from "./types";
import { InputManager } from "./input";
import { AudioEngine } from "./audio";

const WIDTH = 960;
const HEIGHT = 600;
const PLAYER_FIRE_INTERVAL = 0.18;
const STARTING_LIVES = 3;

export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: (finalScore: number) => void;
}

export class Game {
  phase: GamePhase = "idle";
  score = 0;
  lives = STARTING_LIVES;

  private player: Player;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private stars: { x: number; y: number; z: number }[] = [];

  private elapsed = 0;
  private spawnTimer = 0;
  private lastTime = 0;
  private rafId: number | null = null;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private input: InputManager,
    private audio: AudioEngine,
    private callbacks: GameCallbacks,
  ) {
    this.player = this.makePlayer();
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        z: Math.random() * 0.8 + 0.2,
      });
    }
  }

  private makePlayer(): Player {
    return {
      x: WIDTH / 2,
      y: HEIGHT - 70,
      w: 34,
      h: 34,
      speed: 300,
      fireCooldown: 0,
      invulnerable: 0,
    };
  }

  /** Starts the render loop in idle state (no gameplay yet). */
  startIdleLoop(): void {
    this.lastTime = performance.now();
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  start(): void {
    this.phase = "playing";
    this.score = 0;
    this.lives = STARTING_LIVES;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.player = this.makePlayer();
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onLivesChange(this.lives);
    this.lastTime = performance.now();
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Test-only hook: force a game-over transition through the normal path. */
  endForTest(score: number): void {
    if (this.phase !== "playing") return;
    this.score = Math.max(0, Math.trunc(score));
    this.callbacks.onScoreChange(this.score);
    this.triggerGameOver();
  }

  private loop = (time: number): void => {
    const dt = Math.min((time - this.lastTime) / 1000, 1 / 30);
    this.lastTime = time;
    if (this.phase === "playing") {
      this.update(dt);
    }
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private difficultyLevel(): number {
    return 1 + this.elapsed / 18;
  }

  private update(dt: number): void {
    this.elapsed += dt;
    const level = this.difficultyLevel();

    // Player movement
    const ax = this.input.axisX();
    const ay = this.input.axisY();
    const mag = Math.hypot(ax, ay) || 1;
    const nx = mag > 1 ? ax / mag : ax;
    const ny = mag > 1 ? ay / mag : ay;
    this.player.x = clamp(this.player.x + nx * this.player.speed * dt, this.player.w / 2, WIDTH - this.player.w / 2);
    this.player.y = clamp(this.player.y + ny * this.player.speed * dt, this.player.h / 2, HEIGHT - this.player.h / 2);

    // Player firing
    this.player.fireCooldown -= dt;
    if (this.input.firing && this.player.fireCooldown <= 0) {
      this.player.fireCooldown = PLAYER_FIRE_INTERVAL;
      this.projectiles.push({
        x: this.player.x,
        y: this.player.y - this.player.h / 2,
        vx: 0,
        vy: -560,
        w: 4,
        h: 14,
        fromPlayer: true,
      });
      this.audio.shoot();
    }
    if (this.player.invulnerable > 0) this.player.invulnerable -= dt;

    // Spawn enemies
    this.spawnTimer -= dt;
    const spawnInterval = Math.max(0.35, 1.1 - level * 0.08);
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnInterval;
      this.spawnEnemy(level);
    }

    // Update enemies
    for (const enemy of this.enemies) {
      enemy.wobble += dt * 3;
      enemy.x += (enemy.vx + Math.sin(enemy.wobble) * 40) * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = clamp(enemy.x, enemy.w / 2, WIDTH - enemy.w / 2);
      if (enemy.fires) {
        enemy.fireCooldown -= dt;
        if (enemy.fireCooldown <= 0) {
          enemy.fireCooldown = 1.6 - Math.min(0.8, level * 0.05);
          this.projectiles.push({
            x: enemy.x,
            y: enemy.y + enemy.h / 2,
            vx: 0,
            vy: 220 + level * 8,
            w: 4,
            h: 12,
            fromPlayer: false,
          });
        }
      }
    }

    // Update projectiles
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.projectiles = this.projectiles.filter((p) => p.y > -20 && p.y < HEIGHT + 20);

    // Update particles
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    this.handleCollisions();

    // Enemies that escape past the bottom cost nothing extra, just despawn
    this.enemies = this.enemies.filter((e) => e.y < HEIGHT + 60 && e.hp > 0);
  }

  private spawnEnemy(level: number): void {
    const type = Math.random();
    const hp = type < 0.15 ? 3 : 1;
    const w = hp > 1 ? 42 : 30;
    this.enemies.push({
      x: Math.random() * (WIDTH - 60) + 30,
      y: -30,
      w,
      h: w,
      vx: (Math.random() - 0.5) * 30,
      vy: 60 + level * 12 + Math.random() * 30,
      hp,
      scoreValue: hp > 1 ? 30 : 10,
      wobble: Math.random() * Math.PI * 2,
      fireCooldown: Math.random() * 1.5 + 0.5,
      fires: Math.random() < Math.min(0.5, 0.15 + level * 0.03),
    });
  }

  private handleCollisions(): void {
    // Player projectiles vs enemies
    for (const proj of this.projectiles) {
      if (!proj.fromPlayer) continue;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        if (rectsOverlap(proj, enemy)) {
          enemy.hp -= 1;
          proj.y = -999; // mark for removal
          if (enemy.hp <= 0) {
            this.score += enemy.scoreValue;
            this.callbacks.onScoreChange(this.score);
            this.spawnExplosion(enemy.x, enemy.y);
            this.audio.explosion();
          }
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.y > -900);

    // Enemy projectiles / enemy bodies vs player
    if (this.player.invulnerable <= 0) {
      for (const proj of this.projectiles) {
        if (proj.fromPlayer) continue;
        if (rectsOverlap(proj, this.player)) {
          proj.y = -999;
          this.damagePlayer();
          break;
        }
      }
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0) continue;
        if (rectsOverlap(enemy, this.player)) {
          enemy.hp = 0;
          this.spawnExplosion(enemy.x, enemy.y);
          this.damagePlayer();
          break;
        }
      }
      this.projectiles = this.projectiles.filter((p) => p.y > -900);
    }
  }

  private damagePlayer(): void {
    this.lives -= 1;
    this.player.invulnerable = 1.5;
    this.callbacks.onLivesChange(this.lives);
    this.audio.hit();
    this.spawnExplosion(this.player.x, this.player.y);
    if (this.lives <= 0) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    if (this.phase !== "playing") return;
    this.phase = "gameover";
    this.audio.gameOver();
    this.callbacks.onGameOver(this.score);
  }

  private spawnExplosion(x: number, y: number): void {
    const colors = ["#ff2fd0", "#2fe8ff", "#f5ff2f"];
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Background
    ctx.fillStyle = "#060010";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (const star of this.stars) {
      star.y += star.z * 40 * (1 / 60);
      if (star.y > HEIGHT) star.y = 0;
      ctx.fillStyle = `rgba(180, 210, 255, ${star.z})`;
      ctx.fillRect(star.x, star.y, 1.5, 1.5);
    }

    if (this.phase === "idle") return;

    // Player
    if (this.phase === "playing" && (this.player.invulnerable <= 0 || Math.floor(this.elapsed * 12) % 2 === 0)) {
      drawShip(ctx, this.player.x, this.player.y, this.player.w, "#2fe8ff", "#ff2fd0");
    }

    // Enemies
    for (const enemy of this.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(Math.PI);
      const color = enemy.hp > 1 ? "#8a2fff" : "#ff4d4d";
      drawShip(ctx, 0, 0, enemy.w, color, "#f5ff2f");
      ctx.restore();
    }

    // Projectiles
    for (const p of this.projectiles) {
      ctx.fillStyle = p.fromPlayer ? "#f5ff2f" : "#ff4d4d";
      ctx.shadowColor = ctx.fillStyle as string;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      ctx.shadowBlur = 0;
    }

    // Particles
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
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
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, glow: string): void {
  const half = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 10;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.lineTo(half * 0.85, half * 0.8);
  ctx.lineTo(0, half * 0.4);
  ctx.lineTo(-half * 0.85, half * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2
  );
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export { WIDTH, HEIGHT };
