import type { GameSession } from './types';

function drawGlow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
}

export function getMotionProfile(reducedMotion: boolean) {
  return reducedMotion ? { gridAlpha: 0.16, glowBlur: 0 } : { gridAlpha: 0.3, glowBlur: 18 };
}

export function renderGame(ctx: CanvasRenderingContext2D, session: GameSession, reducedMotion = false) {
  const { width, height } = session.bounds;
  const motion = getMotionProfile(reducedMotion);
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#080b1a');
  gradient.addColorStop(1, '#111a3c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = motion.gridAlpha;
  ctx.strokeStyle = '#293566';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  drawGlow(ctx, session.player.invulnerableMs > 0 ? '#ffffff' : '#7cf5d2', motion.glowBlur);
  ctx.beginPath();
  ctx.moveTo(session.player.x + session.player.width / 2, session.player.y);
  ctx.lineTo(session.player.x + session.player.width, session.player.y + session.player.height);
  ctx.lineTo(session.player.x, session.player.y + session.player.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  for (const enemy of session.enemies) {
    ctx.save();
    drawGlow(ctx, '#ff5f8f', reducedMotion ? 0 : 14);
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    ctx.fillStyle = '#ffd1df';
    ctx.fillRect(enemy.x + 7, enemy.y + 7, enemy.width - 14, 5);
    ctx.restore();
  }

  for (const projectile of session.projectiles) {
    ctx.save();
    drawGlow(ctx, '#ffd166', reducedMotion ? 0 : 12);
    ctx.fillRect(projectile.x, projectile.y, projectile.width, projectile.height);
    ctx.restore();
  }

  if (session.phase === 'game-over') {
    ctx.fillStyle = 'rgba(4, 6, 18, 0.64)';
    ctx.fillRect(0, 0, width, height);
  }
}
