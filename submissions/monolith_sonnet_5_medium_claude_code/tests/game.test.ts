import { describe, expect, it, vi } from "vitest";
import { Game, clamp, rectsOverlap } from "../src/game";
import { InputManager } from "../src/input";
import { AudioEngine } from "../src/audio";

describe("clamp", () => {
  it("clamps within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("rectsOverlap", () => {
  it("detects overlapping rectangles", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 5, w: 10, h: 10 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it("detects non-overlapping rectangles", () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 100, y: 100, w: 10, h: 10 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});

function makeStubContext(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    fill: noop,
    arc: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    set fillStyle(_v: unknown) {},
    get fillStyle() {
      return "#000";
    },
    set shadowColor(_v: unknown) {},
    set shadowBlur(_v: unknown) {},
    set globalAlpha(_v: unknown) {},
  } as unknown as CanvasRenderingContext2D;
}

describe("Game", () => {
  it("starts with full lives and zero score", () => {
    document.body.innerHTML = '<div id="s"></div><div id="n"></div><button id="f"></button>';
    const input = new InputManager(
      document.getElementById("s")!,
      document.getElementById("n")!,
      document.getElementById("f")!,
    );
    const audio = new AudioEngine();
    const onScoreChange = vi.fn();
    const onLivesChange = vi.fn();
    const onGameOver = vi.fn();
    const game = new Game(makeStubContext(), input, audio, {
      onScoreChange,
      onLivesChange,
      onGameOver,
    });
    game.start();
    expect(game.score).toBe(0);
    expect(game.lives).toBe(3);
    expect(game.phase).toBe("playing");
    game.stop();
  });

  it("endForTest transitions to gameover with the given score", () => {
    document.body.innerHTML = '<div id="s2"></div><div id="n2"></div><button id="f2"></button>';
    const input = new InputManager(
      document.getElementById("s2")!,
      document.getElementById("n2")!,
      document.getElementById("f2")!,
    );
    const audio = new AudioEngine();
    const onGameOver = vi.fn();
    const game = new Game(makeStubContext(), input, audio, {
      onScoreChange: vi.fn(),
      onLivesChange: vi.fn(),
      onGameOver,
    });
    game.start();
    game.endForTest(42.9);
    expect(game.phase).toBe("gameover");
    expect(game.score).toBe(42);
    expect(onGameOver).toHaveBeenCalledWith(42);
    game.stop();
  });

  it("endForTest clamps negative scores to zero", () => {
    document.body.innerHTML = '<div id="s3"></div><div id="n3"></div><button id="f3"></button>';
    const input = new InputManager(
      document.getElementById("s3")!,
      document.getElementById("n3")!,
      document.getElementById("f3")!,
    );
    const audio = new AudioEngine();
    const game = new Game(makeStubContext(), input, audio, {
      onScoreChange: vi.fn(),
      onLivesChange: vi.fn(),
      onGameOver: vi.fn(),
    });
    game.start();
    game.endForTest(-5);
    expect(game.score).toBe(0);
    game.stop();
  });
});
