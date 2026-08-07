import { describe, expect, it } from 'vitest';
import { NeonBarrageGame } from './game';
import { normalizePlayerName, validatePlayerName, validateScore } from './validation';

describe('validation', () => {
  it('accepts valid names', () => {
    expect(validatePlayerName('ACE')).toBeNull();
    expect(validatePlayerName('neon_pilot-1')).toBeNull();
    expect(validatePlayerName('A'.repeat(16))).toBeNull();
  });

  it('rejects invalid names', () => {
    expect(validatePlayerName('')).not.toBeNull();
    expect(validatePlayerName('   ')).not.toBeNull();
    expect(validatePlayerName('A'.repeat(17))).not.toBeNull();
    expect(validatePlayerName('bad@name')).not.toBeNull();
  });

  it('validates scores', () => {
    expect(validateScore(0)).toBeNull();
    expect(validateScore(12345)).toBeNull();
    expect(validateScore(-1)).not.toBeNull();
    expect(validateScore(1.5)).not.toBeNull();
    expect(validateScore(100_000_001)).not.toBeNull();
  });

  it('normalizes names by trimming', () => {
    expect(normalizePlayerName('  ace  ')).toBe('ace');
  });
});

describe('NeonBarrageGame', () => {
  it('starts in ready phase and transitions to playing', () => {
    const game = new NeonBarrageGame();
    expect(game.getSnapshot().phase).toBe('ready');
    game.start();
    const state = game.getSnapshot();
    expect(state.phase).toBe('playing');
    expect(state.score).toBe(0);
    expect(state.lives).toBe(3);
  });

  it('endGameForTest sets game over with provided score', () => {
    const phases: string[] = [];
    const game = new NeonBarrageGame({
      onPhase: (phase) => phases.push(phase),
    });
    game.start();
    game.endGameForTest(42);
    const state = game.getSnapshot();
    expect(state.phase).toBe('gameover');
    expect(state.score).toBe(42);
    expect(state.lives).toBe(0);
    expect(phases).toContain('gameover');
  });

  it('clamps negative test scores to zero', () => {
    const game = new NeonBarrageGame();
    game.endGameForTest(-9);
    expect(game.getSnapshot().score).toBe(0);
  });

  it('moves player with input and fires projectiles', () => {
    const game = new NeonBarrageGame();
    game.start();
    const before = game.getSnapshot();
    game.update(0.1, { left: true, right: false, up: false, down: false, fire: false });
    const moved = game.getSnapshot();
    expect(moved.playerX).toBeLessThan(before.playerX);

    game.update(0.05, { left: false, right: false, up: false, down: false, fire: true });
    expect(game.getSnapshot().projectileCount).toBeGreaterThan(0);
  });

  it('spawns enemies over time and escalates activity', () => {
    const game = new NeonBarrageGame();
    game.start();
    for (let i = 0; i < 40; i++) {
      game.update(0.1, { left: false, right: false, up: false, down: false, fire: false });
    }
    expect(game.getSnapshot().enemyCount).toBeGreaterThan(0);
  });
});
