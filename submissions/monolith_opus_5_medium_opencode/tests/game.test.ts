import { describe, expect, it, beforeEach } from 'vitest';
import { Game, WORLD, reseed, validateName, validateScore, NAME_RE } from '../src/game';

const idle = { left: false, right: false, up: false, down: false, fire: false };
const tick = (g: Game, seconds: number, input = idle, step = 1 / 60) => {
  for (let t = 0; t < seconds; t += step) g.update(step, input);
};

describe('lifecycle', () => {
  beforeEach(() => reseed(12345));

  it('starts idle and transitions to playing', () => {
    const g = new Game();
    expect(g.snapshot().phase).toBe('idle');
    g.start();
    expect(g.snapshot()).toMatchObject({ phase: 'playing', score: 0, lives: 3 });
  });

  it('does not simulate gameplay while idle', () => {
    const g = new Game();
    tick(g, 3, { ...idle, fire: true });
    expect(g.enemies.length).toBe(0);
    expect(g.projectiles.length).toBe(0);
  });

  it('restart resets score and lives', () => {
    const g = new Game();
    g.start();
    g.score = 500;
    g.lives = 1;
    g.start();
    expect(g.score).toBe(0);
    expect(g.lives).toBe(3);
    expect(g.phase).toBe('playing');
  });
});

describe('movement and firing', () => {
  beforeEach(() => reseed(999));

  it('moves the player with directional input and clamps to the world', () => {
    const g = new Game();
    g.start();
    const x0 = g.player.x;
    tick(g, 0.5, { ...idle, right: true });
    expect(g.player.x).toBeGreaterThan(x0);
    tick(g, 10, { ...idle, right: true });
    expect(g.player.x).toBeLessThanOrEqual(WORLD.w);
    tick(g, 10, { ...idle, up: true });
    expect(g.player.y).toBeGreaterThanOrEqual(WORLD.h * 0.35);
  });

  it('fires bullets on a cooldown, not every frame', () => {
    const g = new Game();
    g.start();
    g.update(1 / 60, { ...idle, fire: true });
    const first = g.projectiles.filter((p) => !p.hostile).length;
    expect(first).toBe(1);
    g.update(1 / 60, { ...idle, fire: true });
    expect(g.projectiles.filter((p) => !p.hostile).length).toBe(1);
    tick(g, 0.4, { ...idle, fire: true });
    expect(g.projectiles.filter((p) => !p.hostile).length).toBeGreaterThan(1);
  });
});

describe('collisions and scoring', () => {
  beforeEach(() => reseed(4242));

  it('destroys an enemy hit by a player bullet and awards points', () => {
    const g = new Game();
    g.start();
    g.enemies = [
      {
        x: 100, y: 200, vx: 0, vy: 0, r: 13, hp: 1, maxHp: 1,
        kind: 'drone', points: 60, fireCooldown: 99, phase: 0, hitFlash: 0,
      },
    ];
    g.projectiles = [{ x: 100, y: 200, vx: 0, vy: 0, hostile: false, r: 4 }];
    g.update(1 / 60, idle);
    expect(g.enemies.length).toBe(0);
    expect(g.score).toBe(60);
    expect(g.particles.length).toBeGreaterThan(0);
  });

  it('costs a life when a hostile bullet connects, then grants i-frames', () => {
    const g = new Game();
    g.start();
    g.invuln = 0;
    g.enemies = [];
    g.projectiles = [{ x: g.player.x, y: g.player.y, vx: 0, vy: 0, hostile: true, r: 4 }];
    g.update(1 / 60, idle);
    expect(g.lives).toBe(2);
    expect(g.invuln).toBeGreaterThan(0);

    g.projectiles = [{ x: g.player.x, y: g.player.y, vx: 0, vy: 0, hostile: true, r: 4 }];
    g.update(1 / 60, idle);
    expect(g.lives).toBe(2);
  });

  it('ends the game when lives reach zero', () => {
    const g = new Game();
    g.start();
    for (let i = 0; i < 3; i++) {
      g.invuln = 0;
      g.projectiles = [{ x: g.player.x, y: g.player.y, vx: 0, vy: 0, hostile: true, r: 4 }];
      g.update(1 / 60, idle);
    }
    expect(g.lives).toBe(0);
    expect(g.phase).toBe('gameover');
  });
});

describe('difficulty escalation', () => {
  beforeEach(() => reseed(77));

  it('advances waves over time and increases difficulty', () => {
    const g = new Game();
    g.start();
    const d0 = g.difficulty;
    for (let t = 0; t < 40; t += 1 / 60) {
      g.invuln = 5; // survive long enough to observe wave escalation
      g.update(1 / 60, idle);
    }
    expect(g.wave).toBeGreaterThan(1);
    expect(g.difficulty).toBeGreaterThan(d0);
  });

  it('spawns enemies during play', () => {
    const g = new Game();
    g.start();
    tick(g, 5);
    expect(g.enemies.length).toBeGreaterThan(0);
  });
});

describe('test adapter behaviour', () => {
  it('endGame forces game over with a non-negative integer score', () => {
    const g = new Game();
    g.start();
    g.endGame(12345);
    expect(g.snapshot()).toMatchObject({ phase: 'gameover', score: 12345, lives: 0 });
    expect(g.drainEvents().some((e) => e.type === 'gameover')).toBe(true);
  });

  it('floors and clamps odd scores', () => {
    const g = new Game();
    g.start();
    g.endGame(-5.9);
    expect(g.score).toBe(0);
  });
});

describe('validation mirrors the database constraints', () => {
  it('accepts 1-16 character names and trims', () => {
    expect(validateName('  Ace  ')).toEqual({ ok: true, name: 'Ace' });
    expect(validateName('A'.repeat(16)).ok).toBe(true);
  });

  it('rejects empty, long and illegal names', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('   ').ok).toBe(false);
    expect(validateName('A'.repeat(17)).ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
    expect(NAME_RE.test('drop; --')).toBe(false);
  });

  it('accepts only plausible integer scores', () => {
    expect(validateScore(0)).toBe(true);
    expect(validateScore(9_999_999)).toBe(true);
    expect(validateScore(-1)).toBe(false);
    expect(validateScore(1.5)).toBe(false);
    expect(validateScore(10_000_001)).toBe(false);
    expect(validateScore(Number.NaN)).toBe(false);
  });
});
