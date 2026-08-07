import { describe, expect, it } from 'vitest';
import { AudioSystem } from '../audio';
import { GameEngine } from './engine';
import type { InputState } from './types';

class SilentAudio extends AudioSystem {
  override async unlock(): Promise<void> {}
  override playShoot(): void {}
  override playHit(): void {}
  override playExplosion(): void {}
  override playGameOver(): void {}
  override playStart(): void {}
}

const idle: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
};

describe('GameEngine', () => {
  it('starts in menu and transitions to playing', () => {
    const engine = new GameEngine(new SilentAudio());
    expect(engine.getSnapshot().phase).toBe('menu');
    engine.start();
    const snap = engine.getSnapshot();
    expect(snap.phase).toBe('playing');
    expect(snap.lives).toBe(3);
    expect(snap.score).toBe(0);
  });

  it('moves the player with input', () => {
    const engine = new GameEngine(new SilentAudio());
    engine.start();
    const before = engine.getSnapshot().playerX;
    engine.update(200, { ...idle, right: true });
    expect(engine.getSnapshot().playerX).toBeGreaterThan(before);
  });

  it('endGameForTest drives game-over with provided score', () => {
    const engine = new GameEngine(new SilentAudio());
    engine.start();
    engine.endGameForTest(1234);
    const snap = engine.getSnapshot();
    expect(snap.phase).toBe('gameover');
    expect(snap.score).toBe(1234);
    expect(snap.lives).toBe(0);
  });

  it('spawns enemies over time while playing', () => {
    const engine = new GameEngine(new SilentAudio());
    engine.start();
    for (let i = 0; i < 40; i++) {
      engine.update(50, idle);
    }
    expect(engine.getSnapshot().enemyCount).toBeGreaterThan(0);
  });

  it('fires projectiles on Space input', () => {
    const engine = new GameEngine(new SilentAudio());
    engine.start();
    engine.update(20, { ...idle, fire: true });
    expect(engine.getSnapshot().projectileCount).toBeGreaterThan(0);
  });
});
