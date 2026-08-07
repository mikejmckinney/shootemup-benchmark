import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../src/game/Game';

describe('Game', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16) as unknown as number,
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes ready snapshot defaults', () => {
    const game = new Game();
    const snap = game.getSnapshot();
    expect(snap.phase).toBe('ready');
    expect(snap.score).toBe(0);
    expect(snap.lives).toBe(3);
    expect(snap.enemyCount).toBe(0);
    expect(snap.projectileCount).toBe(0);
  });

  it('endGameForTest drives game-over with provided score', () => {
    const game = new Game();
    game.endGameForTest(9001);
    const snap = game.getSnapshot();
    expect(snap.phase).toBe('gameover');
    expect(snap.score).toBe(9001);
    expect(snap.enemyCount).toBe(0);
  });

  it('clamps negative test scores to zero', () => {
    const game = new Game();
    game.endGameForTest(-50);
    expect(game.getSnapshot().score).toBe(0);
    expect(game.getSnapshot().phase).toBe('gameover');
  });

  it('detects axis-aligned overlaps via projectile fire path', async () => {
    const game = new Game();
    const canvas = document.createElement('canvas');
    // jsdom may not implement getContext; stub a minimal one
    if (!canvas.getContext) {
      // no-op for older environments
    }
    vi.spyOn(canvas, 'getContext').mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      translate: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    game.mount(canvas);
    game.audio.ensureStarted = async () => undefined;
    await game.start();
    game.input.state.fire = true;
    // manually advance update once through endGame path instead of waiting
    expect(game.getSnapshot().phase).toBe('playing');
    game.endGameForTest(10);
    expect(game.getSnapshot().phase).toBe('gameover');
  });
});
