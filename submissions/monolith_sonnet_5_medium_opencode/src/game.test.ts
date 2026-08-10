import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from './game';
import { AudioEngine } from './audio';

// jsdom provides canvas element but not a real 2D context; stub minimal API.
function stubCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 600;
  const ctx: any = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    set fillStyle(_: any) {},
    set shadowColor(_: any) {},
    set shadowBlur(_: any) {},
    set globalAlpha(_: any) {},
  };
  canvas.getContext = () => ctx;
  return canvas;
}

describe('Game', () => {
  let canvas: HTMLCanvasElement;
  let audio: AudioEngine;
  let onScoreChange: ReturnType<typeof vi.fn>;
  let onLivesChange: ReturnType<typeof vi.fn>;
  let onGameOver: ReturnType<typeof vi.fn>;
  let game: Game;

  beforeEach(() => {
    canvas = stubCanvas();
    audio = new AudioEngine();
    onScoreChange = vi.fn();
    onLivesChange = vi.fn();
    onGameOver = vi.fn();
    game = new Game(canvas, audio, { onScoreChange, onLivesChange, onGameOver });
  });

  it('starts idle and reports idle phase in public state', () => {
    const state = game.getPublicState();
    expect(state.phase).toBe('idle');
    expect(state.score).toBe(0);
    expect(state.lives).toBe(3);
  });

  it('start() transitions to playing with reset score/lives', () => {
    game.start();
    const state = game.getPublicState();
    expect(state.phase).toBe('playing');
    expect(state.score).toBe(0);
    expect(state.lives).toBe(3);
    expect(onScoreChange).toHaveBeenCalledWith(0);
    expect(onLivesChange).toHaveBeenCalledWith(3);
    game.stop();
  });

  it('endGameForTest transitions to gameover with the given score and fires callback', () => {
    game.start();
    game.endGameForTest(4200);
    const state = game.getPublicState();
    expect(state.phase).toBe('gameover');
    expect(state.score).toBe(4200);
    expect(onGameOver).toHaveBeenCalledWith(4200);
  });

  it('endGameForTest clamps negative/non-integer scores to a non-negative integer', () => {
    game.start();
    game.endGameForTest(-15.7 as unknown as number);
    const state = game.getPublicState();
    expect(state.score).toBe(0);
  });

  it('endGameForTest is idempotent once already in gameover phase', () => {
    game.start();
    game.endGameForTest(100);
    game.endGameForTest(999);
    // onGameOver should only fire once (second call is a no-op transition guard)
    expect(onGameOver).toHaveBeenCalledTimes(1);
  });

  it('reports player position within canvas bounds after starting', () => {
    game.start();
    const state = game.getPublicState();
    expect(state.playerX).toBeGreaterThanOrEqual(0);
    expect(state.playerX).toBeLessThanOrEqual(960);
    expect(state.playerY).toBeGreaterThanOrEqual(0);
    expect(state.playerY).toBeLessThanOrEqual(600);
    game.stop();
  });
});
