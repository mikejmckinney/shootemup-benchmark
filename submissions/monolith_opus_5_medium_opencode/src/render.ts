import { Game, WORLD } from './game';

const CYAN = '#7df9ff';
const MAGENTA = '#ff4d9d';
const VIOLET = '#b06bff';

export function draw(ctx: CanvasRenderingContext2D, g: Game, time: number): void {
  const { w, h } = WORLD;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0a0618');
  grad.addColorStop(0.55, '#0d0a24');
  grad.addColorStop(1, '#160b28');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // horizon grid
  ctx.strokeStyle = 'rgba(125,249,255,0.10)';
  ctx.lineWidth = 1;
  const off = (time * 26) % 40;
  for (let y = -40 + off; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // stars
  for (const s of g.stars) {
    ctx.fillStyle = s.size > 1 ? 'rgba(255,255,255,0.85)' : 'rgba(176,107,255,0.7)';
    ctx.fillRect(s.x, s.y, s.size, s.size * 2);
  }

  if (g.shake > 0) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  // particles
  for (const p of g.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // projectiles
  for (const p of g.projectiles) {
    const color = p.hostile ? MAGENTA : CYAN;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    if (p.hostile) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - 1.7, p.y - 9, 3.4, 16);
    }
  }
  ctx.shadowBlur = 0;

  // enemies
  for (const e of g.enemies) {
    const color = e.kind === 'brute' ? MAGENTA : e.kind === 'weaver' ? VIOLET : '#5ce1e6';
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.sin(e.phase * 1.4) * 0.18);
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.strokeStyle = e.hitFlash > 0 ? '#ffffff' : color;
    ctx.fillStyle = 'rgba(10,6,24,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (e.kind === 'brute') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.r;
        const py = Math.sin(a) * e.r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
    } else if (e.kind === 'weaver') {
      ctx.moveTo(0, e.r);
      ctx.lineTo(e.r, -e.r * 0.4);
      ctx.lineTo(0, -e.r * 0.1);
      ctx.lineTo(-e.r, -e.r * 0.4);
    } else {
      ctx.moveTo(0, e.r);
      ctx.lineTo(e.r, -e.r);
      ctx.lineTo(-e.r, -e.r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (e.maxHp > 1) {
      const bw = e.r * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 8, bw, 3);
      ctx.fillStyle = color;
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 8, (bw * e.hp) / e.maxHp, 3);
    }
  }
  ctx.shadowBlur = 0;

  // player
  if (g.phase !== 'idle') {
    const blink = g.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.translate(g.player.x, g.player.y);
    // thruster
    const flame = 10 + Math.sin(time * 40) * 4;
    ctx.shadowBlur = 20;
    ctx.shadowColor = MAGENTA;
    ctx.fillStyle = MAGENTA;
    ctx.beginPath();
    ctx.moveTo(-5, 10);
    ctx.lineTo(5, 10);
    ctx.lineTo(0, 10 + flame);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 22;
    ctx.shadowColor = CYAN;
    ctx.strokeStyle = CYAN;
    ctx.fillStyle = 'rgba(12,20,40,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(12, 10);
    ctx.lineTo(4, 6);
    ctx.lineTo(-4, 6);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1.5, -8, 3, 8);
    ctx.restore();
  }

  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}
