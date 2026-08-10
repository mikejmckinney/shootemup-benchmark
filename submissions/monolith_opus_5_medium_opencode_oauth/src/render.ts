import { Game, WORLD_H, WORLD_W, type Enemy } from './engine';

const ENEMY_COLORS: Record<Enemy['kind'], [string, string]> = {
  grunt: ['#ff2fd0', '#7a0f5e'],
  weaver: ['#b6ff3c', '#3d6b00'],
  tank: ['#ffc447', '#7a4a00'],
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round((rect.width || WORLD_W) * dpr));
    const h = Math.max(1, Math.round((rect.height || WORLD_H) * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
  }

  draw(game: Game, time: number): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.min(cw / WORLD_W, ch / WORLD_H);
    const ox = (cw - WORLD_W * scale) / 2;
    const oy = (ch - WORLD_H * scale) / 2;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04010f';
    ctx.fillRect(0, 0, cw, ch);

    const shake = game.shake;
    const sx = shake > 0 ? (Math.random() - 0.5) * 12 * shake * scale : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * 12 * shake * scale : 0;
    ctx.translate(ox + sx, oy + sy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();

    this.background(game, time);
    this.particles(game);
    this.enemies(game);
    this.projectiles(game);
    if (game.phase !== 'gameover') this.player(game, time);

    ctx.restore();
    void this.dpr;
  }

  private background(game: Game, time: number): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, '#150637');
    g.addColorStop(0.55, '#080220');
    g.addColorStop(1, '#12043a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // moving horizon grid
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#6f3cff';
    ctx.lineWidth = 1;
    const offset = (time * 40) % 48;
    for (let y = -48 + offset; y < WORLD_H; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
    }
    for (let x = 0; x <= WORLD_W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    for (const s of game.stars) {
      ctx.globalAlpha = 0.25 + s.z * 0.45;
      ctx.fillStyle = s.z > 1 ? '#9fe9ff' : '#c9b6ff';
      ctx.fillRect(s.x, s.y, s.size, s.size * 2.4);
    }
    ctx.restore();
  }

  private particles(game: Game): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of game.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = `hsl(${p.hue} 100% ${45 + t * 35}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private enemies(game: Game): void {
    const ctx = this.ctx;
    for (const e of game.enemies) {
      const [bright, dark] = ENEMY_COLORS[e.kind];
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.shadowBlur = 18;
      ctx.shadowColor = bright;
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : dark;
      ctx.strokeStyle = e.hitFlash > 0 ? '#ffffff' : bright;
      ctx.lineWidth = 2;

      ctx.beginPath();
      if (e.kind === 'tank') {
        const r = e.r;
        ctx.moveTo(0, r);
        ctx.lineTo(-r, r * 0.25);
        ctx.lineTo(-r * 0.6, -r * 0.85);
        ctx.lineTo(r * 0.6, -r * 0.85);
        ctx.lineTo(r, r * 0.25);
      } else if (e.kind === 'weaver') {
        ctx.moveTo(0, e.r);
        ctx.lineTo(-e.r, 0);
        ctx.lineTo(0, -e.r);
        ctx.lineTo(e.r, 0);
      } else {
        ctx.moveTo(0, e.r);
        ctx.lineTo(-e.r, -e.r * 0.7);
        ctx.lineTo(0, -e.r * 0.25);
        ctx.lineTo(e.r, -e.r * 0.7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (e.maxHp > 2) {
        ctx.shadowBlur = 0;
        const w = e.r * 1.8;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(-w / 2, -e.r - 9, w, 3);
        ctx.fillStyle = bright;
        ctx.fillRect(-w / 2, -e.r - 9, (w * Math.max(0, e.hp)) / e.maxHp, 3);
      }
      ctx.restore();
    }
  }

  private projectiles(game: Game): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of game.projectiles) {
      ctx.shadowBlur = 12;
      if (b.hostile) {
        ctx.shadowColor = '#ff4d6d';
        ctx.fillStyle = '#ff8fa3';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowColor = '#33f5ff';
        ctx.fillStyle = '#d8ffff';
        ctx.fillRect(b.x - b.r, b.y - 9, b.r * 2, 16);
      }
    }
    ctx.restore();
  }

  private player(game: Game, time: number): void {
    const ctx = this.ctx;
    const p = game.player;
    if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    // thruster
    ctx.globalCompositeOperation = 'lighter';
    const flame = 12 + Math.sin(time * 40) * 5;
    const grd = ctx.createLinearGradient(0, 10, 0, 10 + flame);
    grd.addColorStop(0, 'rgba(51,245,255,0.9)');
    grd.addColorStop(1, 'rgba(138,92,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(6, 10);
    ctx.lineTo(0, 10 + flame);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.shadowBlur = 20;
    ctx.shadowColor = '#33f5ff';
    ctx.fillStyle = '#0d2a4d';
    ctx.strokeStyle = '#33f5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(13, 12);
    ctx.lineTo(0, 6);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff2fd0';
    ctx.fillStyle = '#ff2fd0';
    ctx.beginPath();
    ctx.arc(0, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
