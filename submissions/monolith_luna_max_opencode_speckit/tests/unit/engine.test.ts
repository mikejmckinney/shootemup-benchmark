import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, WORLD_BOUNDS } from '../../src/game/config';
import {
  createInitialSession,
  restartSession,
  startSession,
  step,
} from '../../src/game/engine';
import type { InputState } from '../../src/game/types';

const input = (changes: Partial<InputState> = {}): InputState => ({
  ...EMPTY_INPUT,
  ...changes,
});

describe('game engine', () => {
  it('creates the ready state with three lives and a bounded player', () => {
    const session = createInitialSession();

    expect(session.phase).toBe('ready');
    expect(session.score).toBe(0);
    expect(session.lives).toBe(3);
    expect(session.player.x).toBeGreaterThanOrEqual(0);
    expect(session.player.x + session.player.width).toBeLessThanOrEqual(WORLD_BOUNDS.width);
  });

  it('moves the player without crossing world bounds', () => {
    let session = startSession(createInitialSession());
    session = step(session, input({ left: true, up: true }), 10_000, () => 0.5);

    expect(session.phase).toBe('playing');
    expect(session.player.x).toBe(0);
    expect(session.player.y).toBe(0);
  });

  it('fires projectiles and spawns deterministic enemies', () => {
    let session = startSession(createInitialSession());
    session = step(session, input({ fire: true }), 200, () => 0.25);

    expect(session.projectiles).toHaveLength(1);
    expect(session.enemies.length).toBeGreaterThan(0);
  });

  it('increases difficulty as the session advances', () => {
    let session = startSession(createInitialSession());
    session = step(session, EMPTY_INPUT, 16_000, () => 0.5);

    expect(session.difficultyLevel).toBeGreaterThan(1);
  });

  it('enters game over when lives are exhausted and restart resets state', () => {
    let session = startSession(createInitialSession());
    session = { ...session, lives: 0, score: 120 };
    session = step(session, EMPTY_INPUT, 16, () => 0.5);

    expect(session.phase).toBe('game-over');
    expect(session.score).toBe(120);

    const restarted = restartSession(session);
    expect(restarted.phase).toBe('playing');
    expect(restarted.score).toBe(0);
    expect(restarted.lives).toBe(3);
    expect(restarted.enemies).toHaveLength(0);
    expect(restarted.projectiles).toHaveLength(0);
  });
});
