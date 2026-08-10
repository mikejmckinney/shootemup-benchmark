import { describe, it, expect } from 'vitest';
import { createGame, PHASE, WORLD, makeRng } from '../src/game.js';

function advance(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) game.update(step);
}

describe('simulation lifecycle', () => {
  it('starts in ready phase with three lives and no score', () => {
    const game = createGame({ seed: 7 });
    expect(game.state.phase).toBe(PHASE.READY);
    expect(game.snapshot()).toMatchObject({ score: 0, lives: 3, enemyCount: 0, projectileCount: 0 });
  });

  it('does not simulate gameplay until started', () => {
    const game = createGame({ seed: 7 });
    game.setInput('fire', true);
    advance(game, 3);
    expect(game.state.bullets).toHaveLength(0);
    expect(game.state.enemies).toHaveLength(0);
  });

  it('spawns enemies once playing', () => {
    const game = createGame({ seed: 11 });
    game.start();
    advance(game, 4);
    expect(game.state.enemies.length).toBeGreaterThan(0);
    expect(game.state.phase).toBe(PHASE.PLAYING);
  });
});

describe('input and movement', () => {
  it('moves the player horizontally and clamps to the world', () => {
    const game = createGame({ seed: 3 });
    game.start();
    const startX = game.state.player.x;
    game.setInput('right', true);
    advance(game, 0.5);
    expect(game.state.player.x).toBeGreaterThan(startX);

    advance(game, 5);
    expect(game.state.player.x).toBeLessThanOrEqual(WORLD.width);
    expect(game.state.player.x).toBeGreaterThan(WORLD.width - 40);
  });

  it('keeps the player inside the lower play area vertically', () => {
    const game = createGame({ seed: 3 });
    game.start();
    game.setInput('up', true);
    advance(game, 5);
    expect(game.state.player.y).toBeGreaterThanOrEqual(WORLD.height * 0.35);
  });

  it('fires bullets on a cooldown rather than every frame', () => {
    const game = createGame({ seed: 5 });
    game.start();
    game.setInput('fire', true);
    game.update(1 / 60);
    expect(game.state.bullets).toHaveLength(1);
    game.update(1 / 60);
    expect(game.state.bullets).toHaveLength(1); // still cooling down
    advance(game, 0.2);
    expect(game.state.bullets.length).toBeGreaterThan(1);
  });
});

describe('collisions and scoring', () => {
  it('awards points and removes the enemy when a bullet connects', () => {
    const game = createGame({ seed: 21 });
    game.start();
    game.state.enemies.push({
      kind: 'drone', x: 240, y: 200, w: 28, h: 22, hp: 1, maxHp: 1, points: 100,
      color: '#fff', speed: 0, sway: 0, phase: 0, fireTimer: 999, hitFlash: 0,
    });
    game.state.bullets.push({ x: 240, y: 204, w: 3, h: 14, vx: 0 });
    game.update(1 / 60);
    expect(game.state.enemies).toHaveLength(0);
    expect(game.state.score).toBe(100);
  });

  it('requires multiple hits for armoured enemies', () => {
    const game = createGame({ seed: 22 });
    game.start();
    const enemy = {
      kind: 'bruiser', x: 240, y: 200, w: 40, h: 34, hp: 3, maxHp: 3, points: 550,
      color: '#fff', speed: 0, sway: 0, phase: 0, fireTimer: 999, hitFlash: 0,
    };
    game.state.enemies.push(enemy);
    game.state.bullets.push({ x: 240, y: 200, w: 3, h: 14, vx: 0 });
    game.update(1 / 60);
    expect(game.state.enemies).toHaveLength(1);
    expect(enemy.hp).toBe(2);
    expect(game.state.score).toBe(0);
  });

  it('applies a combo multiplier after five consecutive kills', () => {
    const game = createGame({ seed: 23 });
    game.start();
    for (let i = 0; i < 6; i += 1) {
      game.state.enemies.push({
        kind: 'drone', x: 240, y: 200, w: 28, h: 22, hp: 1, maxHp: 1, points: 100,
        color: '#fff', speed: 0, sway: 0, phase: 0, fireTimer: 999, hitFlash: 0,
      });
      game.state.bullets.push({ x: 240, y: 200, w: 3, h: 14, vx: 0 });
      game.update(1 / 60);
    }
    expect(game.state.combo).toBe(6);
    // First four kills at x1, the fifth and sixth at the x2 combo tier.
    expect(game.state.score).toBe(800);
  });

  it('loses a life on collision and ends the game at zero lives', () => {
    const game = createGame({ seed: 24 });
    game.start();
    const hitPlayer = () => {
      game.state.player.invuln = 0;
      game.state.enemies.push({
        kind: 'drone', x: game.state.player.x, y: game.state.player.y, w: 28, h: 22,
        hp: 1, maxHp: 1, points: 100, color: '#fff', speed: 0, sway: 0, phase: 0,
        fireTimer: 999, hitFlash: 0,
      });
      game.update(1 / 60);
    };
    hitPlayer();
    expect(game.state.lives).toBe(2);
    hitPlayer();
    hitPlayer();
    expect(game.state.lives).toBe(0);
    expect(game.state.phase).toBe(PHASE.GAME_OVER);
  });

  it('grants brief invulnerability so one enemy cannot drain every life', () => {
    const game = createGame({ seed: 25 });
    game.start();
    for (let i = 0; i < 3; i += 1) {
      game.state.enemies.push({
        kind: 'drone', x: game.state.player.x, y: game.state.player.y, w: 28, h: 22,
        hp: 1, maxHp: 1, points: 100, color: '#fff', speed: 0, sway: 0, phase: 0,
        fireTimer: 999, hitFlash: 0,
      });
    }
    game.update(1 / 60);
    expect(game.state.lives).toBe(2);
  });
});

describe('difficulty escalation', () => {
  it('advances waves over time', () => {
    const game = createGame({ seed: 31 });
    game.start();
    expect(game.state.wave).toBe(1);
    // Survive the whole stretch so the wave timer, not a death, decides the phase.
    for (let t = 0; t < 23; t += 0.05) {
      game.state.player.invuln = 5;
      game.update(0.05);
    }
    expect(game.state.wave).toBeGreaterThanOrEqual(2);
  });

  it('spawns more enemies per unit time at higher waves', () => {
    const count = (wave) => {
      const game = createGame({ seed: 41 });
      game.start();
      game.state.wave = wave;
      let spawned = 0;
      const seen = new Set();
      for (let i = 0; i < 300; i += 1) {
        game.update(1 / 60);
        for (const e of game.state.enemies) {
          if (!seen.has(e)) { seen.add(e); spawned += 1; }
        }
        game.state.wave = wave; // hold the wave fixed for the comparison
      }
      return spawned;
    };
    expect(count(8)).toBeGreaterThan(count(1));
  });
});

describe('test adapter contract', () => {
  it('endGame transitions to game over with a non-negative integer score', () => {
    const game = createGame({ seed: 51 });
    game.start();
    game.endGame(4321);
    const snap = game.snapshot();
    expect(snap.phase).toBe('gameover');
    expect(snap.score).toBe(4321);
    expect(snap.lives).toBe(0);
    expect(Number.isInteger(snap.score)).toBe(true);
  });

  it('emits a gameover event so the UI can react', () => {
    const events = [];
    const game = createGame({ seed: 52, onEvent: (e) => events.push(e.type) });
    game.start();
    game.endGame(10);
    expect(events).toContain('gameover');
  });

  it('snapshot exposes exactly the documented fields', () => {
    const game = createGame({ seed: 53 });
    expect(Object.keys(game.snapshot()).sort()).toEqual(
      ['enemyCount', 'lives', 'phase', 'playerX', 'playerY', 'projectileCount', 'score'],
    );
  });

  it('restart clears score and restores lives', () => {
    const game = createGame({ seed: 54 });
    game.start();
    game.endGame(9999);
    game.start();
    expect(game.state.score).toBe(0);
    expect(game.state.lives).toBe(3);
    expect(game.state.phase).toBe(PHASE.PLAYING);
  });
});

describe('rng', () => {
  it('is deterministic for a seed and stays in [0,1)', () => {
    const a = makeRng(99);
    const b = makeRng(99);
    for (let i = 0; i < 50; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
