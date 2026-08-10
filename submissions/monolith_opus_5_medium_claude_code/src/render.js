// Canvas renderer. Draws the whole scene in world coordinates (480x720);
// main.js applies the device-pixel scale transform before calling in.

import { WORLD, PHASE } from './game.js';

const PALETTE = {
  bg0: '#05030f',
  bg1: '#150a2e',
  grid: 'rgba(120, 80, 255, 0.16)',
  player: '#7cf9ff',
  playerCore: '#ffffff',
  thruster: '#ff4fd8',
};

function roundedShip(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.lineTo(x, y + h / 4);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.closePath();
}

function enemyShape(ctx, e) {
  const { x, y, w, h } = e;
  ctx.beginPath();
  if (e.kind === 'bruiser') {
    ctx.moveTo(x - w / 2, y - h / 4);
    ctx.lineTo(x - w / 4, y - h / 2);
    ctx.lineTo(x + w / 4, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 4);
    ctx.lineTo(x + w / 3, y + h / 2);
    ctx.lineTo(x - w / 3, y + h / 2);
  } else if (e.kind === 'weaver') {
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w / 2, y - h / 4);
    ctx.lineTo(x + w / 5, y - h / 2);
    ctx.lineTo(x - w / 5, y - h / 2);
    ctx.lineTo(x - w / 2, y - h / 4);
  } else {
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.lineTo(x - w / 2, y - h / 2);
  }
  ctx.closePath();
}

export function render(ctx, state, timeMs) {
  const t = timeMs / 1000;

  ctx.save();
  if (state.shake > 0) {
    const s = state.shake * 6;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  bg.addColorStop(0, PALETTE.bg1);
  bg.addColorStop(1, PALETTE.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, WORLD.width + 40, WORLD.height + 40);

  // Perspective floor grid for depth.
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  const offset = (t * 40) % 48;
  for (let y = -48; y < WORLD.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y + offset);
    ctx.lineTo(WORLD.width, y + offset);
    ctx.stroke();
  }
  for (let x = 0; x <= WORLD.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }

  for (const star of state.stars) {
    ctx.globalAlpha = 0.25 + star.z * 0.6;
    ctx.fillStyle = star.z > 0.9 ? '#ff9ae8' : '#cfe9ff';
    ctx.fillRect(star.x, star.y, star.z * 1.8, star.z * 4);
  }
  ctx.globalAlpha = 1;

  // Particles.
  for (const p of state.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // Player bullets.
  for (const b of state.bullets) {
    ctx.fillStyle = '#b6faff';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#38f2ff';
    ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  // Enemy bullets.
  for (const b of state.enemyBullets) {
    ctx.fillStyle = '#ffb0c8';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff2e63';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.w / 2 + 1, b.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Enemies.
  for (const e of state.enemies) {
    const flash = e.hitFlash > 0;
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = e.color;
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(10, 6, 26, 0.85)';
    enemyShape(ctx, e);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = flash ? '#ffffff' : e.color;
    ctx.stroke();
    ctx.restore();

    if (e.maxHp > 1) {
      const w = e.w;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(e.x - w / 2, e.y + e.h / 2 + 4, w, 3);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - w / 2, e.y + e.h / 2 + 4, (w * e.hp) / e.maxHp, 3);
    }
  }

  // Player.
  const p = state.player;
  if (state.phase !== PHASE.GAME_OVER) {
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;

    const flame = 8 + Math.sin(t * 30) * 4;
    ctx.fillStyle = PALETTE.thruster;
    ctx.shadowBlur = 18;
    ctx.shadowColor = PALETTE.thruster;
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y + p.h / 2 - 2);
    ctx.lineTo(p.x, p.y + p.h / 2 + flame);
    ctx.lineTo(p.x + 5, p.y + p.h / 2 - 2);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 20;
    ctx.shadowColor = PALETTE.player;
    ctx.fillStyle = 'rgba(12, 20, 40, 0.9)';
    roundedShip(ctx, p.x, p.y, p.w, p.h);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.player;
    ctx.stroke();

    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.fillRect(p.x - 2, p.y - 6, 4, 10);
    ctx.restore();
  }
  ctx.shadowBlur = 0;

  // Floating score text.
  ctx.textAlign = 'center';
  ctx.font = '700 15px "Chakra Petch", system-ui, sans-serif';
  for (const f of state.floatingTexts) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = '#ffe98a';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Wave banner.
  if (state.phase === PHASE.PLAYING) {
    ctx.font = '600 13px "Chakra Petch", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180, 220, 255, 0.55)';
    ctx.textAlign = 'left';
    ctx.fillText(`WAVE ${state.wave}`, 14, 26);
    if (state.combo >= 5) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(`COMBO x${1 + Math.min(4, Math.floor(state.combo / 5))}`, WORLD.width - 14, 26);
    }
  }

  // Vignette + scanlines for the arcade CRT feel.
  const vignette = ctx.createRadialGradient(
    WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.25,
    WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let y = 0; y < WORLD.height; y += 4) ctx.fillRect(0, y, WORLD.width, 1);

  ctx.restore();
}
