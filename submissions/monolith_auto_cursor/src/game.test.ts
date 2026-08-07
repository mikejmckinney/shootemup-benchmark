import { describe, expect, it } from 'vitest';
import {
  Game,
  aabb,
  clamp,
  validatePlayerName,
  validateScore,
  type InputState,
} from './game';

const idle: InputState = { up: false, down: false, left: false, right: false, fire: false };

describe('helpers', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });

  it('detects aabb overlap', () => {
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 })).toBe(false);
  });

  it('validates player names', () => {
    expect(validatePlayerName('')).toBeTruthy();
    expect(validatePlayerName('a'.repeat(17))).toBeTruthy();
    expect(validatePlayerName('bad!')).toBeTruthy();
    expect(validatePlayerName('Ace_Pilot')).toBeNull();
  });

  it('validates scores', () => {
    expect(validateScore(-1)).toBeTruthy();
    expect(validateScore(1.5)).toBeTruthy();
    expect(validateScore(0)).toBeNull();
    expect(validateScore(999)).toBeNull();
  });
});

describe('Game', () => {
  it('starts in title and can reset into playing', () => {
    const g = new Game();
    expect(g.getSnapshot().phase).toBe('title');
    g.reset();
    expect(g.getSnapshot().phase).toBe('playing');
    expect(g.getSnapshot().lives).toBe(3);
    expect(g.getSnapshot().score).toBe(0);
  });

  it('moves the player with input', () => {
    const g = new Game();
    g.reset();
    const before = g.getSnapshot().playerX;
    g.update(0.1, { ...idle, right: true });
    expect(g.getSnapshot().playerX).toBeGreaterThan(before);
  });

  it('fires projectiles on fire input', () => {
    const g = new Game();
    g.reset();
    g.update(0.05, { ...idle, fire: true });
    expect(g.getSnapshot().projectileCount).toBeGreaterThan(0);
  });

  it('endGameForTest drives gameover with provided score', () => {
    const g = new Game();
    g.reset();
    let reported = -1;
    g.onGameOver = (s) => {
      reported = s;
    };
    g.endGameForTest(1234);
    const snap = g.getSnapshot();
    expect(snap.phase).toBe('gameover');
    expect(snap.score).toBe(1234);
    expect(reported).toBe(1234);
  });

  it('awards score when a player projectile destroys an enemy', () => {
    const g = new Game();
    g.reset();
    g.enemies = [
      {
        x: 100,
        y: 100,
        w: 28,
        h: 24,
        vx: 0,
        vy: 0,
        alive: true,
        hp: 1,
        kind: 'scout',
        value: 100,
        phase: 0,
      },
    ];
    g.projectiles = [
      {
        x: 105,
        y: 105,
        w: 6,
        h: 14,
        vx: 0,
        vy: 0,
        alive: true,
        fromPlayer: true,
        damage: 1,
      },
    ];
    g.update(0.016, idle);
    expect(g.score).toBe(100);
    expect(g.enemies.length).toBe(0);
  });
});
