import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MAX_SCORE,
  clamp,
  createInitialState,
  rectanglesOverlap,
  stepGameState
} from './game-logic.js';

const TAU = Math.PI * 2;

export class NeonGame {
  constructor(canvas, { onStateChange = () => {}, onEvent = () => {}, onGameOver = () => {} } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onStateChange = onStateChange;
    this.onEvent = onEvent;
    this.onGameOver = onGameOver;
    this.state = createInitialState();
    this.input = { left: false, right: false, up: false, down: false, fire: false };
    this.stars = Array.from({ length: 105 }, (_, index) => ({
      x: (index * 97.31) % WORLD_WIDTH,
      y: (index * 53.73) % WORLD_HEIGHT,
      size: 0.55 + ((index * 17) % 10) / 10,
      speed: 9 + ((index * 29) % 35),
      alpha: 0.2 + ((index * 13) % 60) / 100
    }));
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.lastFrame = 0;
    this.animationFrame = 0;
    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    this.resize();
    this.render(0);
  }

  resize() {
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(WORLD_WIDTH * pixelRatio);
    this.canvas.height = Math.round(WORLD_HEIGHT * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  getPublicState() {
    return {
      phase: this.state.phase,
      score: this.state.score,
      lives: this.state.lives,
      playerX: this.state.player.x,
      playerY: this.state.player.y,
      enemyCount: this.state.enemies.length,
      projectileCount: this.state.projectiles.length
    };
  }

  start() {
    this.state = createInitialState();
    this.state.phase = 'running';
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.lastFrame = performance.now();
    this.onStateChange(this.getPublicState(), this.state);
    this.onEvent({ type: 'start' });
    this.stopLoop();
    this.animationFrame = requestAnimationFrame((time) => this.loop(time));
  }

  stopLoop() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
  }

  endGameForTest(score) {
    if (!Number.isSafeInteger(score) || score < 0) return false;
    this.state.score = Math.min(score, MAX_SCORE);
    this.state.lives = 0;
    this.state.phase = 'game-over';
    this.state.enemies = [];
    this.state.projectiles = [];
    this.state.enemyProjectiles = [];
    this.stopLoop();
    this.onStateChange(this.getPublicState(), this.state);
    this.onEvent({ type: 'game-over', score: this.state.score, test: true });
    this.onGameOver(this.getPublicState(), this.state);
    this.render(performance.now());
    return true;
  }

  setInput(name, active) {
    if (name in this.input) this.input[name] = Boolean(active);
  }

  loop(timestamp) {
    if (this.state.phase !== 'running') {
      this.render(timestamp);
      this.animationFrame = 0;
      return;
    }
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - this.lastFrame) / 1000));
    this.lastFrame = timestamp;
    const events = stepGameState(this.state, this.input, deltaSeconds);
    for (const event of events) this.handleEvent(event);
    this.updateParticles(deltaSeconds);
    this.onStateChange(this.getPublicState(), this.state);
    this.render(timestamp);
    if (this.state.phase === 'game-over') {
      this.onGameOver(this.getPublicState(), this.state);
      this.onEvent({ type: 'gameover-sound' });
      this.animationFrame = 0;
      return;
    }
    this.animationFrame = requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  handleEvent(event) {
    if (event.type === 'fire') this.onEvent(event);
    if (event.type === 'enemy-hit') {
      this.addBurst(event.x, event.y, event.destroyed ? '#ff4fcf' : '#64ecff', event.destroyed ? 15 : 5);
      this.onEvent(event.destroyed ? { type: 'destroy' } : { type: 'hit' });
    }
    if (event.type === 'enemy-destroyed') {
      this.floaters.push({ x: event.x, y: event.y, text: `+${event.points}`, life: 0.9, color: '#ffca70' });
    }
    if (event.type === 'player-hit') {
      this.shake = 12;
      this.addBurst(event.x, event.y, '#ff547e', 24);
      this.onEvent({ type: 'danger' });
    }
  }

  addBurst(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * TAU + Math.random() * 0.4;
      const speed = 25 + Math.random() * 115;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.35 + Math.random() * 0.45, maxLife: 0.8, size: 1 + Math.random() * 3, color });
    }
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const floater of this.floaters) {
      floater.y -= 23 * dt;
      floater.life -= dt;
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
    this.shake = Math.max(0, this.shake - dt * 32);
  }

  render(timestamp) {
    const ctx = this.context;
    if (!ctx) return;
    ctx.save();
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawBackground(timestamp);
    const shakeX = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(shakeX, shakeY);
    this.drawEnemyProjectiles();
    this.drawProjectiles();
    this.drawEnemies();
    this.drawPlayer(timestamp);
    this.drawParticles();
    this.drawFloaters();
    ctx.restore();
  }

  drawBackground(timestamp) {
    const ctx = this.context;
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    gradient.addColorStop(0, '#080d2a');
    gradient.addColorStop(0.52, '#10123b');
    gradient.addColorStop(1, '#190b2c');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const glow = ctx.createRadialGradient(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.83, 4, WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.83, 310);
    glow.addColorStop(0, 'rgba(48, 236, 255, .14)');
    glow.addColorStop(1, 'rgba(48, 236, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const elapsed = timestamp / 1000;
    for (const star of this.stars) {
      const y = (star.y + elapsed * star.speed) % WORLD_HEIGHT;
      ctx.fillStyle = `rgba(151, 226, 255, ${star.alpha})`;
      ctx.fillRect(star.x, y, star.size, star.size);
    }

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = '#51b7df';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, WORLD_HEIGHT * 0.62);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = WORLD_HEIGHT * 0.64; y < WORLD_HEIGHT; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, .018)';
    for (let y = 0; y < WORLD_HEIGHT; y += 5) ctx.fillRect(0, y, WORLD_WIDTH, 1);
  }

  drawPlayer(timestamp) {
    const ctx = this.context;
    const player = this.state.player;
    if (this.state.invulnerable > 0 && Math.floor(timestamp / 80) % 2 === 0) return;
    const cx = player.x + player.width / 2;
    const top = player.y;
    ctx.save();
    ctx.shadowColor = '#52efff';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#5beaff';
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(cx, player.y + player.height - 9);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#121c49';
    ctx.beginPath();
    ctx.moveTo(cx, top + 8);
    ctx.lineTo(cx + 9, player.y + player.height - 8);
    ctx.lineTo(cx, player.y + player.height - 14);
    ctx.lineTo(cx - 9, player.y + player.height - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3bd';
    ctx.fillRect(cx - 2, top + 10, 4, 9);
    ctx.fillStyle = '#ff4fcf';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(player.x + 8, player.y + player.height - 2);
    ctx.lineTo(player.x + 14, player.y + player.height + 12 + Math.sin(timestamp / 75) * 4);
    ctx.lineTo(player.x + 19, player.y + player.height - 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(player.x + player.width - 8, player.y + player.height - 2);
    ctx.lineTo(player.x + player.width - 14, player.y + player.height + 12 + Math.sin(timestamp / 75) * 4);
    ctx.lineTo(player.x + player.width - 19, player.y + player.height - 3);
    ctx.fill();
    ctx.restore();
    if (this.state.invulnerable > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(91, 234, 255, .72)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(cx, player.y + player.height / 2, 31 + Math.sin(timestamp / 110) * 3, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawProjectiles() {
    const ctx = this.context;
    for (const projectile of this.state.projectiles) {
      ctx.save();
      ctx.shadowColor = '#ffca70';
      ctx.shadowBlur = 18;
      const gradient = ctx.createLinearGradient(0, projectile.y, 0, projectile.y + projectile.height);
      gradient.addColorStop(0, '#fff7d0');
      gradient.addColorStop(1, '#ff7aaf');
      ctx.fillStyle = gradient;
      ctx.fillRect(projectile.x, projectile.y, projectile.width, projectile.height);
      ctx.restore();
    }
  }

  drawEnemyProjectiles() {
    const ctx = this.context;
    for (const projectile of this.state.enemyProjectiles) {
      ctx.save();
      ctx.shadowColor = '#ff4f87';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff568d';
      ctx.beginPath();
      ctx.moveTo(projectile.x + projectile.width / 2, projectile.y + projectile.height);
      ctx.lineTo(projectile.x, projectile.y);
      ctx.lineTo(projectile.x + projectile.width, projectile.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawEnemies() {
    const ctx = this.context;
    for (const enemy of this.state.enemies) {
      const cx = enemy.x + enemy.width / 2;
      const cy = enemy.y + enemy.height / 2;
      ctx.save();
      ctx.shadowColor = enemy.type === 'tank' ? '#ffca70' : enemy.type === 'wisp' ? '#b072ff' : '#ff4fcf';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = enemy.type === 'tank' ? '#ffc56e' : enemy.type === 'wisp' ? '#ba7cff' : '#ff4fcf';
      ctx.fillStyle = enemy.type === 'tank' ? 'rgba(105, 62, 46, .95)' : enemy.type === 'wisp' ? 'rgba(65, 39, 111, .94)' : 'rgba(92, 21, 91, .95)';
      ctx.lineWidth = 2;
      if (enemy.type === 'tank') {
        ctx.beginPath();
        ctx.moveTo(cx, enemy.y);
        ctx.lineTo(enemy.x + enemy.width, enemy.y + 10);
        ctx.lineTo(enemy.x + enemy.width - 6, enemy.y + enemy.height - 4);
        ctx.lineTo(enemy.x + 6, enemy.y + enemy.height - 4);
        ctx.lineTo(enemy.x, enemy.y + 10);
        ctx.closePath();
      } else if (enemy.type === 'wisp') {
        ctx.beginPath();
        ctx.moveTo(cx, enemy.y);
        ctx.quadraticCurveTo(enemy.x + enemy.width + 10, cy, cx, enemy.y + enemy.height);
        ctx.quadraticCurveTo(enemy.x - 10, cy, cx, enemy.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(cx, enemy.y);
        ctx.lineTo(enemy.x + enemy.width, cy);
        ctx.lineTo(cx, enemy.y + enemy.height);
        ctx.lineTo(enemy.x, cy);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = enemy.type === 'tank' ? '#ffe0a0' : '#ffddf5';
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
      if (enemy.maxHp > 1) {
        ctx.fillStyle = 'rgba(7, 10, 28, .8)';
        ctx.fillRect(enemy.x, enemy.y - 8, enemy.width, 3);
        ctx.fillStyle = '#ffc56e';
        ctx.fillRect(enemy.x, enemy.y - 8, enemy.width * (enemy.hp / enemy.maxHp), 3);
      }
      ctx.restore();
    }
  }

  drawParticles() {
    const ctx = this.context;
    for (const particle of this.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 9;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      ctx.restore();
    }
  }

  drawFloaters() {
    const ctx = this.context;
    ctx.save();
    ctx.font = '600 13px "DM Mono", monospace';
    ctx.textAlign = 'center';
    for (const floater of this.floaters) {
      ctx.globalAlpha = clamp(floater.life, 0, 1);
      ctx.fillStyle = floater.color;
      ctx.shadowColor = floater.color;
      ctx.shadowBlur = 10;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }
}

export function isPointInEntity(x, y, entity) {
  return rectanglesOverlap({ x, y, width: 1, height: 1 }, entity);
}
