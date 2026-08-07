import {
  ENEMY_BASE_SPEED,
  FIRE_COOLDOWN_MS,
  GAME_HEIGHT,
  GAME_WIDTH,
  INITIAL_LIVES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PROJECTILE_RADIUS,
  PROJECTILE_SPEED,
} from '../config';
import type { AudioSystem } from '../audio';
import type {
  Enemy,
  GameStateSnapshot,
  InputState,
  Particle,
  Phase,
  Player,
  Projectile,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}

export class GameEngine {
  phase: Phase = 'menu';
  score = 0;
  lives = INITIAL_LIVES;
  player: Player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 80,
    radius: PLAYER_RADIUS,
    invulnMs: 0,
  };
  projectiles: Projectile[] = [];
  enemies: Enemy[] = [];
  particles: Particle[] = [];
  elapsedMs = 0;
  spawnAccumulator = 0;
  fireCooldown = 0;
  starField: { x: number; y: number; z: number; speed: number }[] = [];
  private audio: AudioSystem;
  private onPhaseChange?: (phase: Phase) => void;

  constructor(audio: AudioSystem, onPhaseChange?: (phase: Phase) => void) {
    this.audio = audio;
    this.onPhaseChange = onPhaseChange;
    this.resetStars();
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.onPhaseChange?.(phase);
  }

  private resetStars(): void {
    this.starField = Array.from({ length: 60 }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      z: 0.3 + Math.random() * 1.2,
      speed: 20 + Math.random() * 80,
    }));
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
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.elapsedMs = 0;
    this.spawnAccumulator = 0;
    this.fireCooldown = 0;
    this.projectiles = [];
    this.enemies = [];
    this.particles = [];
    this.player = {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 80,
      radius: PLAYER_RADIUS,
      invulnMs: 1000,
    };
    this.resetStars();
    this.setPhase('playing');
    this.audio.playStart();
  }

  endGameForTest(score: number): void {
    const safeScore = Math.max(0, Math.floor(score));
    this.score = safeScore;
    this.lives = 0;
    this.projectiles = [];
    this.enemies = [];
    this.setPhase('gameover');
    this.audio.playGameOver();
  }

  private difficultyFactor(): number {
    return 1 + this.elapsedMs / 45000 + this.score / 2500;
  }

  private spawnEnemy(): void {
    const factor = this.difficultyFactor();
    const roll = Math.random();
    let kind: Enemy['kind'] = 'scout';
    let radius = 14;
    let hp = 1;
    let speed = ENEMY_BASE_SPEED * factor;

    if (roll > 0.82) {
      kind = 'bruiser';
      radius = 22;
      hp = 3;
      speed *= 0.65;
    } else if (roll > 0.55) {
      kind = 'drifter';
      radius = 16;
      hp = 2;
      speed *= 0.85;
    }

    const x = radius + Math.random() * (GAME_WIDTH - radius * 2);
    this.enemies.push({
      x,
      y: -radius - 4,
      vx: (Math.random() - 0.5) * 40 * factor,
      vy: speed,
      radius,
      hp,
      kind,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  private spawnBurst(x: number, y: number, color: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private firePlayer(): void {
    this.projectiles.push({
      x: this.player.x,
      y: this.player.y - this.player.radius,
      vx: 0,
      vy: -PROJECTILE_SPEED,
      radius: PROJECTILE_RADIUS,
      fromPlayer: true,
    });
    this.fireCooldown = FIRE_COOLDOWN_MS;
    this.audio.playShoot();
  }

  private damagePlayer(): void {
    if (this.player.invulnMs > 0) return;
    this.lives -= 1;
    this.player.invulnMs = 1400;
    this.spawnBurst(this.player.x, this.player.y, '#ff4d8d', 14);
    this.audio.playHit();
    if (this.lives <= 0) {
      this.lives = 0;
      this.setPhase('gameover');
      this.audio.playGameOver();
    }
  }

  update(dtMs: number, input: InputState): void {
    const dt = Math.min(dtMs, 32) / 1000;

    for (const star of this.starField) {
      star.y += star.speed * star.z * dt;
      if (star.y > GAME_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * GAME_WIDTH;
      }
    }

    if (this.phase !== 'playing') return;

    this.elapsedMs += dtMs;
    this.fireCooldown = Math.max(0, this.fireCooldown - dtMs);
    this.player.invulnMs = Math.max(0, this.player.invulnMs - dtMs);

    let mx = 0;
    let my = 0;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      this.player.x = clamp(
        this.player.x + mx * PLAYER_SPEED * dt,
        this.player.radius,
        GAME_WIDTH - this.player.radius,
      );
      this.player.y = clamp(
        this.player.y + my * PLAYER_SPEED * dt,
        this.player.radius,
        GAME_HEIGHT - this.player.radius,
      );
    }

    if (input.fire && this.fireCooldown <= 0) {
      this.firePlayer();
    }

    const spawnInterval = Math.max(280, 1100 / this.difficultyFactor());
    this.spawnAccumulator += dtMs;
    while (this.spawnAccumulator >= spawnInterval) {
      this.spawnAccumulator -= spawnInterval;
      this.spawnEnemy();
    }

    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.projectiles = this.projectiles.filter(
      (p) => p.y > -20 && p.y < GAME_HEIGHT + 20 && p.x > -20 && p.x < GAME_WIDTH + 20,
    );

    for (const e of this.enemies) {
      e.pulse += dt * 6;
      if (e.kind === 'drifter') {
        e.x += Math.sin(e.pulse) * 55 * dt + e.vx * dt;
      } else {
        e.x += e.vx * dt;
      }
      e.y += e.vy * dt;
      if (e.x < e.radius || e.x > GAME_WIDTH - e.radius) {
        e.vx *= -1;
        e.x = clamp(e.x, e.radius, GAME_WIDTH - e.radius);
      }
    }

    // Player projectiles vs enemies
    for (const p of this.projectiles) {
      if (!p.fromPlayer) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (circlesOverlap(p.x, p.y, p.radius, e.x, e.y, e.radius)) {
          p.y = -9999;
          e.hp -= 1;
          this.spawnBurst(e.x, e.y, e.kind === 'bruiser' ? '#ff9f1c' : '#39ffe0', 6);
          if (e.hp <= 0) {
            const points = e.kind === 'bruiser' ? 150 : e.kind === 'drifter' ? 80 : 50;
            this.score += points;
            this.spawnBurst(e.x, e.y, '#fff36b', 16);
            this.audio.playExplosion();
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.y < GAME_HEIGHT + 40);
    this.projectiles = this.projectiles.filter((p) => p.y > -20);

    // Enemy contact
    for (const e of this.enemies) {
      if (circlesOverlap(this.player.x, this.player.y, this.player.radius * 0.85, e.x, e.y, e.radius)) {
        this.damagePlayer();
      }
    }

    for (const part of this.particles) {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 0.96;
      part.vy *= 0.96;
      part.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    g.addColorStop(0, '#050814');
    g.addColorStop(0.55, '#0a1634');
    g.addColorStop(1, '#12082a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(57, 255, 224, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GAME_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(GAME_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();

    for (const star of this.starField) {
      ctx.fillStyle = `rgba(200, 230, 255, ${0.25 + star.z * 0.45})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.z, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const part of this.particles) {
      const alpha = clamp(part.life / part.maxLife, 0, 1);
      ctx.fillStyle = part.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const p of this.projectiles) {
      ctx.shadowColor = '#39ffe0';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#e8fffb';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(57,255,224,0.35)';
      ctx.fillRect(p.x - 1.5, p.y, 3, 12);
    }

    for (const e of this.enemies) {
      const pulse = 0.85 + Math.sin(e.pulse) * 0.15;
      const color =
        e.kind === 'bruiser' ? '#ff9f1c' : e.kind === 'drifter' ? '#c77dff' : '#ff4d8d';
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (e.kind === 'bruiser') {
        ctx.moveTo(e.x, e.y - e.radius * pulse);
        ctx.lineTo(e.x + e.radius * pulse, e.y + e.radius * 0.7);
        ctx.lineTo(e.x - e.radius * pulse, e.y + e.radius * 0.7);
        ctx.closePath();
      } else if (e.kind === 'drifter') {
        ctx.ellipse(e.x, e.y, e.radius * pulse, e.radius * 0.7, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(e.x, e.y, e.radius * pulse, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(e.x - 3, e.y - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.phase !== 'menu') {
      const blink = this.player.invulnMs > 0 && Math.floor(this.player.invulnMs / 80) % 2 === 0;
      if (!blink) {
        ctx.shadowColor = '#39ffe0';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#39ffe0';
        ctx.beginPath();
        ctx.moveTo(this.player.x, this.player.y - this.player.radius);
        ctx.lineTo(this.player.x + this.player.radius * 0.85, this.player.y + this.player.radius * 0.8);
        ctx.lineTo(this.player.x, this.player.y + this.player.radius * 0.35);
        ctx.lineTo(this.player.x - this.player.radius * 0.85, this.player.y + this.player.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a1634';
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y + 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.phase === 'menu') {
      this.drawCenteredText(ctx, 'NEON BARRAGE', GAME_HEIGHT * 0.38, 36, '#39ffe0');
      this.drawCenteredText(ctx, 'Survive the neon storm', GAME_HEIGHT * 0.46, 16, '#9eb7ff');
    } else if (this.phase === 'gameover') {
      ctx.fillStyle = 'rgba(5, 8, 20, 0.55)';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      this.drawCenteredText(ctx, 'GAME OVER', GAME_HEIGHT * 0.36, 34, '#ff4d8d');
      this.drawCenteredText(ctx, `SCORE ${this.score}`, GAME_HEIGHT * 0.44, 22, '#fff36b');
    }
  }

  private drawCenteredText(
    ctx: CanvasRenderingContext2D,
    text: string,
    y: number,
    size: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillText(text, GAME_WIDTH / 2, y);
    ctx.shadowBlur = 0;
  }
}

export { GAME_WIDTH, GAME_HEIGHT };
