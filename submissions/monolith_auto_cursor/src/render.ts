import {
  Game,
  WORLD_H,
  WORLD_W,
  type Particle,
  type Enemy,
  type Projectile,
  type Entity,
} from './game';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawStars(ctx: CanvasRenderingContext2D, t: number, seed: number): void {
  ctx.save();
  for (let i = 0; i < 70; i++) {
    const x = ((Math.sin(seed + i * 12.9898) * 43758.5453) % 1) * WORLD_W;
    const yBase = ((Math.sin(seed + i * 78.233) * 23421.631) % 1) * WORLD_H;
    const speed = 20 + (i % 5) * 18;
    const y = (yBase + t * speed) % WORLD_H;
    const alpha = 0.25 + (i % 4) * 0.15;
    ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
  }
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Entity, invuln: number, t: number): void {
  if (invuln > 0 && Math.floor(t * 20) % 2 === 0) return;
  const cx = p.x + p.w / 2;
  ctx.save();
  ctx.shadowColor = '#39f3ff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#39f3ff';
  ctx.beginPath();
  ctx.moveTo(cx, p.y);
  ctx.lineTo(p.x + p.w, p.y + p.h);
  ctx.lineTo(cx, p.y + p.h - 8);
  ctx.lineTo(p.x, p.y + p.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b8ff3d';
  ctx.fillRect(cx - 3, p.y + 8, 6, 10);
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  ctx.save();
  if (e.kind === 'scout') {
    ctx.shadowColor = '#ff3d9a';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff3d9a';
    ctx.beginPath();
    ctx.moveTo(e.x + e.w / 2, e.y + e.h);
    ctx.lineTo(e.x + e.w, e.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'zig') {
    ctx.shadowColor = '#b8ff3d';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#b8ff3d';
    roundRect(ctx, e.x, e.y, e.w, e.h, 4);
    ctx.fill();
    ctx.fillStyle = '#0b1230';
    ctx.fillRect(e.x + 8, e.y + 8, e.w - 16, 4);
  } else {
    ctx.shadowColor = '#ffc14d';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffc14d';
    roundRect(ctx, e.x, e.y, e.w, e.h, 6);
    ctx.fill();
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(e.x + 6, e.y + 10, e.w - 12, 8);
  }
  ctx.restore();
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile): void {
  ctx.save();
  ctx.shadowBlur = 8;
  if (p.fromPlayer) {
    ctx.shadowColor = '#39f3ff';
    ctx.fillStyle = '#e8ffff';
  } else {
    ctx.shadowColor = '#ff4d6d';
    ctx.fillStyle = '#ff8fa3';
  }
  roundRect(ctx, p.x, p.y, p.w, p.h, 2);
  ctx.fill();
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const a = Math.max(0, p.life / p.maxLife);
  ctx.fillStyle = p.color;
  ctx.globalAlpha = a;
  ctx.fillRect(p.x, p.y, p.size, p.size);
  ctx.globalAlpha = 1;
}

export function renderGame(ctx: CanvasRenderingContext2D, game: Game, now: number): void {
  ctx.save();
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);

  const sx = (Math.random() - 0.5) * game.shake * 10;
  const sy = (Math.random() - 0.5) * game.shake * 10;
  ctx.translate(sx, sy);

  const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  grad.addColorStop(0, '#0a1438');
  grad.addColorStop(1, '#050814');
  ctx.fillStyle = grad;
  ctx.fillRect(-20, -20, WORLD_W + 40, WORLD_H + 40);

  drawStars(ctx, now, game.starSeed);

  ctx.strokeStyle = 'rgba(57, 243, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WORLD_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
    ctx.stroke();
  }

  for (const p of game.particles) drawParticle(ctx, p);
  for (const p of game.projectiles) drawProjectile(ctx, p);
  for (const e of game.enemies) drawEnemy(ctx, e);
  if (game.phase !== 'title') {
    drawPlayer(ctx, game.player, game.invuln, now);
  }

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255, 77, 109, ${game.flash * 0.35})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  ctx.restore();
}

export function resizeCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
}
