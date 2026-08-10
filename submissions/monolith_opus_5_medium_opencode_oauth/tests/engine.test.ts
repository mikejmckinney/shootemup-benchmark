import { describe, expect, it } from 'vitest';
import {
  Game,
  WORLD_H,
  WORLD_W,
  circlesOverlap,
  clamp,
  validateName,
  validateScore,
} from '../src/engine';

const step = (g: Game, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) g.update(dt);
};

describe('helpers', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('detects circle overlap', () => {
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 })).toBe(true);
    expect(circlesOverlap({ x: 0, y: 0, r: 5 }, { x: 11, y: 0, r: 5 })).toBe(false);
  });
});

describe('validation', () => {
  it('accepts 1-16 character names and trims them', () => {
    expect(validateName('  Ace  ')).toEqual({ ok: true, name: 'Ace' });
    expect(validateName('A')).toEqual({ ok: true, name: 'A' });
    expect(validateName('0123456789abcdef')).toEqual({ ok: true, name: '0123456789abcdef' });
  });

  it('rejects empty, too long and illegal names', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('   ').ok).toBe(false);
    expect(validateName('0123456789abcdefg').ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
    expect(validateName('drop;table').ok).toBe(false);
  });

  it('only accepts plausible integer scores', () => {
    expect(validateScore(0)).toBe(true);
    expect(validateScore(12345)).toBe(true);
    expect(validateScore(-1)).toBe(false);
    expect(validateScore(1.5)).toBe(false);
    expect(validateScore(Number.NaN)).toBe(false);
    expect(validateScore(10_000_001)).toBe(false);
  });
});

describe('game lifecycle', () => {
  it('starts in the menu phase with default lives', () => {
    const g = new Game();
    expect(g.snapshot().phase).toBe('menu');
    expect(g.snapshot().lives).toBe(3);
  });

  it('resets score and lives on start', () => {
    const g = new Game();
    g.start();
    g.score = 999;
    g.lives = 1;
    g.start();
    expect(g.score).toBe(0);
    expect(g.lives).toBe(3);
    expect(g.phase).toBe('playing');
  });

  it('pauses and resumes', () => {
    const g = new Game();
    g.start();
    g.togglePause();
    expect(g.phase).toBe('paused');
    const before = g.snapshot();
    step(g, 1);
    expect(g.snapshot().enemyCount).toBe(before.enemyCount);
    g.togglePause();
    expect(g.phase).toBe('playing');
  });
});

describe('movement and firing', () => {
  it('moves the player with input and clamps to the world', () => {
    const g = new Game();
    g.start();
    const startX = g.player.x;
    g.input.right = true;
    step(g, 0.5);
    expect(g.player.x).toBeGreaterThan(startX);
    step(g, 5);
    expect(g.player.x).toBeLessThanOrEqual(WORLD_W);
    g.input.right = false;
    g.input.up = true;
    step(g, 5);
    expect(g.player.y).toBeGreaterThanOrEqual(WORLD_H * 0.35 - 1);
  });

  it('fires projectiles on a cooldown', () => {
    const g = new Game();
    g.start();
    g.enemies = [];
    g.input.fire = true;
    g.update(1 / 60);
    const first = g.projectiles.filter((p) => !p.hostile).length;
    expect(first).toBeGreaterThan(0);
    g.update(1 / 60);
    expect(g.projectiles.filter((p) => !p.hostile).length).toBe(first);
  });
});

describe('combat', () => {
  it('destroys an enemy and awards score', () => {
    const g = new Game();
    g.start();
    g.enemies = [];
    g.projectiles = [];
    g.enemies.push({
      id: 1,
      kind: 'grunt',
      x: 100,
      y: 100,
      r: 14,
      hp: 1,
      maxHp: 1,
      vx: 0,
      vy: 0,
      fireIn: 99,
      phase: 0,
      hitFlash: 0,
      points: 100,
    });
    g.projectiles.push({ id: 2, x: 100, y: 100, vx: 0, vy: -1, r: 3.5, hostile: false, damage: 1 });
    g.update(1 / 60);
    expect(g.enemies.length).toBe(0);
    expect(g.score).toBeGreaterThanOrEqual(100);
  });

  it('loses a life when hit by a hostile projectile', () => {
    const g = new Game();
    g.start();
    g.player.invuln = 0;
    g.enemies = [];
    g.projectiles = [
      { id: 9, x: g.player.x, y: g.player.y, vx: 0, vy: 1, r: 5, hostile: true, damage: 1 },
    ];
    g.update(1 / 60);
    expect(g.lives).toBe(2);
    expect(g.player.invuln).toBeGreaterThan(0);
  });

  it('is invulnerable briefly after being hit', () => {
    const g = new Game();
    g.start();
    g.player.invuln = 0;
    g.enemies = [];
    g.projectiles = [
      { id: 9, x: g.player.x, y: g.player.y, vx: 0, vy: 0, r: 5, hostile: true, damage: 1 },
      { id: 10, x: g.player.x, y: g.player.y, vx: 0, vy: 0, r: 5, hostile: true, damage: 1 },
    ];
    g.update(1 / 60);
    g.update(1 / 60);
    expect(g.lives).toBe(2);
  });

  it('ends the game when lives hit zero', () => {
    let reported = -1;
    const g = new Game({ onGameOver: (s) => (reported = s) });
    g.start();
    g.score = 500;
    for (let i = 0; i < 3; i++) {
      g.player.invuln = 0;
      g.enemies = [];
      g.projectiles = [
        { id: 100 + i, x: g.player.x, y: g.player.y, vx: 0, vy: 0, r: 5, hostile: true, damage: 1 },
      ];
      g.update(1 / 60);
    }
    expect(g.lives).toBe(0);
    expect(g.phase).toBe('gameover');
    expect(reported).toBe(500);
  });
});

describe('difficulty and spawning', () => {
  it('spawns enemies over time and escalates difficulty', () => {
    const g = new Game();
    g.start();
    step(g, 3);
    expect(g.enemies.length).toBeGreaterThan(0);
    const early = g.difficulty;
    for (let t = 0; t < 40; t += 1 / 60) {
      g.player.invuln = 5; // survive long enough to observe wave escalation
      g.update(1 / 60);
    }
    expect(g.difficulty).toBeGreaterThan(early);
    expect(g.wave).toBeGreaterThan(1);
  });
});

describe('test adapter behaviour', () => {
  it('endGame transitions to game over with the supplied score', () => {
    const scores: number[] = [];
    const g = new Game({ onGameOver: (s) => scores.push(s) });
    g.start();
    g.endGame(4242);
    const snap = g.snapshot();
    expect(snap.phase).toBe('gameover');
    expect(snap.score).toBe(4242);
    expect(snap.lives).toBe(0);
    expect(scores).toEqual([4242]);
  });

  it('floors and clamps adapter scores to non-negative integers', () => {
    const g = new Game();
    g.start();
    g.endGame(-10);
    expect(g.score).toBe(0);
    g.start();
    g.endGame(12.9);
    expect(g.score).toBe(12);
  });

  it('exposes a complete snapshot shape', () => {
    const g = new Game();
    g.start();
    step(g, 2);
    expect(Object.keys(g.snapshot()).sort()).toEqual(
      ['enemyCount', 'lives', 'phase', 'playerX', 'playerY', 'projectileCount', 'score'].sort(),
    );
  });
});
