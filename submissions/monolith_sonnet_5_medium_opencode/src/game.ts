import { AudioEngine } from './audio';

export type Phase = 'idle' | 'playing' | 'gameover';

export interface PublicState {
  phase: Phase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
}

interface Vec {
  x: number;
  y: number;
}

interface Player extends Vec {
  w: number;
  h: number;
  vx: number;
  vy: number;
  fireCooldown: number;
  invulnerable: number;
  hitFlash: number;
}

interface Bullet extends Vec {
  vx: number;
  vy: number;
  r: number;
  friendly: boolean;
  color: string;
}

interface Enemy extends Vec {
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  kind: 'drone' | 'weaver' | 'brute';
  fireCooldown: number;
  t: number;
}

interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Star extends Vec {
  speed: number;
  size: number;
}

const WIDTH = 960;
const HEIGHT = 600;

export class Game {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private audio: AudioEngine;

  private phase: Phase = 'idle';
  private score = 0;
  private lives = 3;
  private elapsed = 0;
  private difficulty = 1;

  private player: Player;
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];

  private enemySpawnTimer = 0;
  private rafId = 0;
  private lastTime = 0;

  private keys = new Set<string>();
  private touchDir: Vec = { x: 0, y: 0 };
  private touchFiring = false;

  private onScoreChange: (score: number) => void;
  private onLivesChange: (lives: number) => void;
  private onGameOver: (score: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    audio: AudioEngine,
    callbacks: {
      onScoreChange: (score: number) => void;
      onLivesChange: (lives: number) => void;
      onGameOver: (score: number) => void;
    }
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.audio = audio;
    this.onScoreChange = callbacks.onScoreChange;
    this.onLivesChange = callbacks.onLivesChange;
    this.onGameOver = callbacks.onGameOver;

    this.player = {
      x: WIDTH / 2,
      y: HEIGHT - 80,
      w: 34,
      h: 34,
      vx: 0,
      vy: 0,
      fireCooldown: 0,
      invulnerable: 0,
      hitFlash: 0,
    };

    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        speed: 30 + Math.random() * 90,
        size: Math.random() * 2 + 0.5,
      });
    }

    this.bindInput();
    this.loop = this.loop.bind(this);
    this.drawIdleFrame();
  }

  private bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ' || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  setTouchDirection(x: number, y: number) {
    this.touchDir.x = x;
    this.touchDir.y = y;
  }

  setTouchFiring(firing: boolean) {
    this.touchFiring = firing;
  }

  start() {
    this.phase = 'playing';
    this.score = 0;
    this.lives = 3;
    this.elapsed = 0;
    this.difficulty = 1;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.enemySpawnTimer = 0;
    this.player.x = WIDTH / 2;
    this.player.y = HEIGHT - 80;
    this.player.invulnerable = 1.5;
    this.player.hitFlash = 0;
    this.onScoreChange(this.score);
    this.onLivesChange(this.lives);
    this.lastTime = performance.now();
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  getPublicState(): PublicState {
    return {
      phase: this.phase,
      score: this.score,
      lives: this.lives,
      playerX: Math.round(this.player.x),
      playerY: Math.round(this.player.y),
      enemyCount: this.enemies.length,
      projectileCount: this.bullets.length,
    };
  }

  /** Test-only: force an immediate transition to game over with a given score. */
  endGameForTest(score: number) {
    const safe = Math.max(0, Math.floor(Number(score) || 0));
    this.score = safe;
    this.onScoreChange(this.score);
    this.triggerGameOver();
  }

  private triggerGameOver() {
    if (this.phase === 'gameover') return;
    this.phase = 'gameover';
    this.stop();
    this.audio.gameOver();
    this.onGameOver(this.score);
  }

  private loop(now: number) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.phase === 'playing') {
      this.update(dt);
    }
    this.render();
    if (this.phase === 'playing') {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  private update(dt: number) {
    this.elapsed += dt;
    this.difficulty = 1 + this.elapsed / 25;

    this.updateStars(dt);
    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.handleCollisions();
  }

  private updateStars(dt: number) {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > HEIGHT) {
        s.y = 0;
        s.x = Math.random() * WIDTH;
      }
    }
  }

  private inputDirection(): Vec {
    let x = 0;
    let y = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) y -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) y += 1;

    if (x === 0 && y === 0 && (this.touchDir.x !== 0 || this.touchDir.y !== 0)) {
      x = this.touchDir.x;
      y = this.touchDir.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  private isFiring(): boolean {
    return this.keys.has(' ') || this.keys.has('spacebar') || this.touchFiring;
  }

  private updatePlayer(dt: number) {
    const dir = this.inputDirection();
    const speed = 320;
    this.player.x += dir.x * speed * dt;
    this.player.y += dir.y * speed * dt;
    this.player.x = Math.max(20, Math.min(WIDTH - 20, this.player.x));
    this.player.y = Math.max(20, Math.min(HEIGHT - 20, this.player.y));

    this.player.fireCooldown -= dt;
    if (this.player.invulnerable > 0) this.player.invulnerable -= dt;
    if (this.player.hitFlash > 0) this.player.hitFlash -= dt;

    if (this.isFiring() && this.player.fireCooldown <= 0) {
      this.player.fireCooldown = 0.15;
      this.bullets.push({
        x: this.player.x - 8,
        y: this.player.y - 10,
        vx: 0,
        vy: -520,
        r: 4,
        friendly: true,
        color: '#33fff2',
      });
      this.bullets.push({
        x: this.player.x + 8,
        y: this.player.y - 10,
        vx: 0,
        vy: -520,
        r: 4,
        friendly: true,
        color: '#33fff2',
      });
      this.audio.shoot();
    }
  }

  private updateSpawning(dt: number) {
    this.enemySpawnTimer -= dt;
    const interval = Math.max(0.35, 1.4 - this.elapsed / 40);
    if (this.enemySpawnTimer <= 0) {
      this.enemySpawnTimer = interval;
      this.spawnEnemy();
    }
  }

  private spawnEnemy() {
    const roll = Math.random();
    const kind: Enemy['kind'] = roll < 0.55 ? 'drone' : roll < 0.85 ? 'weaver' : 'brute';
    const x = 40 + Math.random() * (WIDTH - 80);
    const base = 60 + this.difficulty * 18;
    if (kind === 'drone') {
      this.enemies.push({
        x,
        y: -30,
        w: 28,
        h: 28,
        vx: 0,
        vy: base * 0.9,
        hp: 1,
        maxHp: 1,
        kind,
        fireCooldown: 1 + Math.random(),
        t: 0,
      });
    } else if (kind === 'weaver') {
      this.enemies.push({
        x,
        y: -30,
        w: 26,
        h: 26,
        vx: 0,
        vy: base,
        hp: 2,
        maxHp: 2,
        kind,
        fireCooldown: 1.2 + Math.random(),
        t: Math.random() * Math.PI * 2,
      });
    } else {
      this.enemies.push({
        x,
        y: -40,
        w: 44,
        h: 40,
        vx: 0,
        vy: base * 0.55,
        hp: 5,
        maxHp: 5,
        kind,
        fireCooldown: 0.8,
        t: 0,
      });
    }
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      e.t += dt;
      if (e.kind === 'weaver') {
        e.x += Math.sin(e.t * 3) * 90 * dt;
      }
      e.y += e.vy * dt;
      e.x = Math.max(16, Math.min(WIDTH - 16, e.x));

      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.y > 0 && e.y < HEIGHT - 60) {
        e.fireCooldown = e.kind === 'brute' ? 1.1 / this.difficulty : 1.8 / this.difficulty;
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const speed = 200 + this.difficulty * 20;
        this.bullets.push({
          x: e.x,
          y: e.y,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          r: 4,
          friendly: false,
          color: '#ff3ad6',
        });
      }
    }
    this.enemies = this.enemies.filter((e) => e.y < HEIGHT + 60 && e.hp > 0);
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.bullets = this.bullets.filter(
      (b) => b.y > -30 && b.y < HEIGHT + 30 && b.x > -30 && b.x < WIDTH + 30
    );
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private spawnExplosion(x: number, y: number, color: string, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private handleCollisions() {
    // Friendly bullets vs enemies
    for (const b of this.bullets) {
      if (!b.friendly) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (Math.abs(dx) < e.w / 2 + b.r && Math.abs(dy) < e.h / 2 + b.r) {
          e.hp -= 1;
          b.y = -9999; // mark for removal
          if (e.hp <= 0) {
            this.score += e.kind === 'brute' ? 50 : e.kind === 'weaver' ? 25 : 10;
            this.onScoreChange(this.score);
            this.spawnExplosion(e.x, e.y, e.kind === 'brute' ? '#ff3ad6' : '#33fff2');
            this.audio.explosion();
          } else {
            this.audio.hit();
          }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.y > -500);

    // Enemy bullets vs player
    if (this.player.invulnerable <= 0) {
      for (const b of this.bullets) {
        if (b.friendly) continue;
        const dx = b.x - this.player.x;
        const dy = b.y - this.player.y;
        if (Math.abs(dx) < this.player.w / 2 + b.r && Math.abs(dy) < this.player.h / 2 + b.r) {
          b.y = -9999;
          this.damagePlayer();
          break;
        }
      }
      this.bullets = this.bullets.filter((b) => b.y > -500);

      // Enemies colliding with player (ramming)
      for (const e of this.enemies) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        if (Math.abs(dx) < (e.w + this.player.w) / 2 && Math.abs(dy) < (e.h + this.player.h) / 2) {
          e.hp = 0;
          this.spawnExplosion(e.x, e.y, '#ff9a3a');
          this.audio.explosion();
          this.damagePlayer();
        }
      }
    }
  }

  private damagePlayer() {
    if (this.player.invulnerable > 0) return;
    this.lives -= 1;
    this.player.invulnerable = 1.2;
    this.player.hitFlash = 0.4;
    this.onLivesChange(this.lives);
    this.audio.hit();
    this.spawnExplosion(this.player.x, this.player.y, '#ff3a3a', 20);
    if (this.lives <= 0) {
      this.triggerGameOver();
    }
  }

  private drawIdleFrame() {
    const { ctx } = this;
    ctx.fillStyle = '#060314';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (const s of this.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }

  private render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#060314';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // stars
    for (const s of this.stars) {
      ctx.fillStyle = 'rgba(200,200,255,0.7)';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    if (this.phase !== 'playing') return;

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // enemies
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const color = e.kind === 'brute' ? '#ff3ad6' : e.kind === 'weaver' ? '#8a3aff' : '#ff9a3a';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, e.h / 2);
      ctx.lineTo(e.w / 2, -e.h / 2);
      ctx.lineTo(-e.w / 2, -e.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (e.maxHp > 1) {
        const barW = e.w;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(e.x - barW / 2, e.y - e.h / 2 - 8, barW, 3);
        ctx.fillStyle = '#33fff2';
        ctx.fillRect(e.x - barW / 2, e.y - e.h / 2 - 8, barW * (e.hp / e.maxHp), 3);
      }
    }

    // bullets
    for (const b of this.bullets) {
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // player
    const flashing = this.player.invulnerable > 0 && Math.floor(this.elapsed * 12) % 2 === 0;
    if (!flashing) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.shadowColor = '#33fff2';
      ctx.shadowBlur = 16;
      ctx.fillStyle = this.player.hitFlash > 0 ? '#ff3a3a' : '#e9e6ff';
      ctx.beginPath();
      ctx.moveTo(0, -this.player.h / 2);
      ctx.lineTo(this.player.w / 2, this.player.h / 2);
      ctx.lineTo(0, this.player.h / 4);
      ctx.lineTo(-this.player.w / 2, this.player.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

export { WIDTH, HEIGHT };
