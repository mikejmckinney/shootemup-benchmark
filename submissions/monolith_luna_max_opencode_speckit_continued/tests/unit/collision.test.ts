import { describe, expect, it } from 'vitest';
import { createInitialSession, startSession } from '../../src/game/engine';
import { resolveCollisions } from '../../src/game/collision';

describe('collision resolution', () => {
  it('removes a hit enemy and projectile and increments score once', () => {
    const base = startSession(createInitialSession());
    const session = {
      ...base,
      enemies: [{ id: 2, x: 100, y: 100, width: 32, height: 28, vx: 0, vy: 0, hp: 1 }],
      projectiles: [{ id: 3, x: 100, y: 100, width: 5, height: 12, vy: -1, damage: 1 }],
    };

    const result = resolveCollisions(session);

    expect(result.enemies).toHaveLength(0);
    expect(result.projectiles).toHaveLength(0);
    expect(result.score).toBe(100);
    expect(resolveCollisions(result).score).toBe(100);
  });

  it('removes a life when an enemy hits the player and keeps the player alive while lives remain', () => {
    const base = startSession(createInitialSession());
    const session = {
      ...base,
      enemies: [{
        id: 2,
        x: base.player.x,
        y: base.player.y,
        width: 32,
        height: 28,
        vx: 0,
        vy: 0,
        hp: 1,
      }],
    };

    const result = resolveCollisions(session);

    expect(result.lives).toBe(2);
    expect(result.phase).toBe('playing');
    expect(result.enemies).toHaveLength(0);
  });
});
