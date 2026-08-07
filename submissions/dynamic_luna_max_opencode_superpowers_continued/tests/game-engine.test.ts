import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game-engine';

describe('GameEngine', () => {
  it('starts with an idle player and three lives', () => {
    const state = new GameEngine().getState();
    expect(state).toMatchObject({ phase: 'idle', score: 0, lives: 3, enemyCount: 0, projectileCount: 0 });
  });

  it('moves within the logical playfield', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    engine.setInput({ left: true, up: true });
    engine.update(10_000);
    expect(engine.getState()).toMatchObject({ playerX: 28, playerY: 28 });

    engine.reset();
    engine.start();
    engine.setInput({ right: true, down: true });
    engine.update(10_000);
    expect(engine.getState()).toMatchObject({ playerX: 932, playerY: 572 });
  });

  it('fires and removes projectiles after leaving the field', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    expect(engine.fire()).toBe(true);
    expect(engine.getState().projectileCount).toBe(1);
    engine.update(3_000);
    expect(engine.getState().projectileCount).toBe(0);
  });

  it('scores a hit and emits a hit event', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    engine.spawnEnemyForTest(480, 500);
    expect(engine.fire()).toBe(true);
    engine.update(300);
    expect(engine.getState().score).toBe(100);
    expect(engine.consumeEvents().some((event) => event.type === 'hit')).toBe(true);
  });

  it('ends after the third damage event', () => {
    const engine = new GameEngine({ width: 960, height: 600 });
    engine.start();
    engine.spawnEnemyForTest(engine.getState().playerX, engine.getState().playerY);
    engine.update(1);
    engine.spawnEnemyForTest(engine.getState().playerX, engine.getState().playerY);
    engine.update(1);
    engine.spawnEnemyForTest(engine.getState().playerX, engine.getState().playerY);
    engine.update(1);
    expect(engine.getState().phase).toBe('game-over');
    expect(engine.getState().lives).toBe(0);

    const events = engine.consumeEvents();
    expect(events.filter((event) => event.type === 'damage')).toHaveLength(3);
    expect(events.filter((event) => event.type === 'game-over')).toHaveLength(1);
    engine.update(10_000);
    expect(engine.consumeEvents()).toEqual([]);
  });

  it('accelerates spawn pacing as the score rises', () => {
    const engine = new GameEngine({ width: 960, height: 600, random: () => 0.5 });
    const initial = engine.getSpawnIntervalForTest(0);
    expect(engine.getSpawnIntervalForTest(5_000)).toBeLessThan(initial);
  });

  it('uses the normal game-over state for a valid test score', () => {
    const engine = new GameEngine();
    engine.endForTest(1234);
    expect(engine.getState()).toMatchObject({ phase: 'game-over', score: 1234, lives: 0 });
    expect(() => engine.endForTest(-1)).toThrow();
    expect(() => engine.endForTest(1.5)).toThrow();
  });

  it('does nothing while idle and guards test spawning by phase', () => {
    const engine = new GameEngine({ random: () => 0.5 });
    const initialState = engine.getState();
    engine.update(10_000);
    expect(engine.getState()).toEqual(initialState);
    expect(engine.fire()).toBe(false);
    engine.spawnEnemyForTest(480, 400);
    expect(engine.getState().enemyCount).toBe(0);

    engine.endForTest(10);
    engine.spawnEnemyForTest(480, 400);
    expect(engine.getState().enemyCount).toBe(0);
  });

  it('resets all run state and can start a fresh run', () => {
    const engine = new GameEngine({ random: () => 0.5 });
    engine.start();
    engine.fire();
    engine.spawnEnemyForTest(480, 400);
    engine.reset();
    expect(engine.getState()).toMatchObject({
      phase: 'idle',
      score: 0,
      lives: 3,
      enemyCount: 0,
      projectileCount: 0,
    });
    expect(engine.consumeEvents()).toEqual([]);

    engine.start();
    expect(engine.getState().phase).toBe('running');
  });

  it('spawns an enemy on the deterministic interval', () => {
    const engine = new GameEngine({ random: () => 0.5 });
    engine.start();
    engine.update(999);
    expect(engine.getState().enemyCount).toBe(0);
    engine.update(1);
    expect(engine.getState().enemyCount).toBe(1);
    expect(engine.getRenderSnapshot().enemies[0]).toMatchObject({ x: 480 });
  });

  it('caps oversized elapsed updates and ignores non-finite elapsed time', () => {
    const engine = new GameEngine({ width: 10_000, height: 10_000 });
    engine.start();
    engine.setInput({ left: true, up: true });
    engine.update(10_000);
    expect(engine.getState()).toMatchObject({ playerX: 4_360, playerY: 9_300 });

    const stateBeforeNonFiniteUpdate = engine.getState();
    engine.update(Number.POSITIVE_INFINITY);
    engine.update(Number.NaN);
    expect(engine.getState()).toEqual(stateBeforeNonFiniteUpdate);
  });

  it('detects projectile hits across a movement step', () => {
    const engine = new GameEngine({ random: () => 0.5 });
    engine.start();
    engine.spawnEnemyForTest(500, 500);
    engine.fire();
    engine.update(100);
    expect(engine.getState()).toMatchObject({ score: 100, enemyCount: 0, projectileCount: 0 });
    expect(engine.consumeEvents().filter((event) => event.type === 'hit')).toHaveLength(1);
  });

  it('exposes a read-only snapshot of the live render entities', () => {
    const engine = new GameEngine({ random: () => 0.5 });
    engine.start();
    engine.spawnEnemyForTest(480, 400);
    engine.fire();
    const snapshot = engine.getRenderSnapshot();

    expect(snapshot).toMatchObject({ width: 960, height: 600, player: { x: 480, y: 540, radius: 20 } });
    expect(snapshot.enemies).toHaveLength(1);
    expect(snapshot.projectiles).toHaveLength(1);
    expect(snapshot.enemies[0]).toMatchObject({ x: 480, y: 400, radius: 18 });

    engine.update(100);
    expect(snapshot.enemies[0]).toMatchObject({ x: 480, y: 400 });
    expect(engine.getRenderSnapshot().enemies[0].y).toBeGreaterThan(400);
  });

  it('normalizes tiny dimensions to keep player bounds valid', () => {
    const engine = new GameEngine({ width: 40, height: 40 });
    expect(engine.getState()).toMatchObject({ playerX: 28, playerY: 28 });
    engine.start();
    engine.setInput({ left: true, up: true });
    engine.update(100);
    expect(engine.getState()).toMatchObject({ playerX: 28, playerY: 28 });
  });
});
