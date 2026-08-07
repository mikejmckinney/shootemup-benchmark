import { describe, expect, it } from 'vitest';
import { circlesOverlap, clamp, formatScore } from './game-math';

describe('Neon Barrage gameplay math', () => {
  it('clamps a ship inside the arena bounds', () => {
    expect(clamp(-4, 0, 960)).toBe(0);
    expect(clamp(480, 0, 960)).toBe(480);
    expect(clamp(1200, 0, 960)).toBe(960);
  });

  it('detects projectile and enemy circle collisions', () => {
    expect(circlesOverlap(10, 10, 4, 16, 10, 3)).toBe(true);
    expect(circlesOverlap(10, 10, 4, 20, 10, 3)).toBe(false);
  });

  it('keeps score labels readable at six digits', () => {
    expect(formatScore(42)).toBe('000042');
    expect(formatScore(987654)).toBe('987654');
  });
});
