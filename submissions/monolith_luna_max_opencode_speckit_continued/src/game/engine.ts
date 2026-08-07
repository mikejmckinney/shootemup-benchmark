import {
  difficultyFor,
  ENEMY_SIZE,
  EMPTY_INPUT,
  FIRE_INTERVAL_MS,
  INITIAL_LIVES,
  PLAYER_SIZE,
  PLAYER_SPEED,
  PROJECTILE_SPEED,
  WORLD_BOUNDS,
} from './config';
import { resolveCollisions } from './collision';
import type { Bounds, GameSession, InputState } from './types';

export function createInitialSession(bounds: Bounds = WORLD_BOUNDS): GameSession {
  return {
    phase: 'ready',
    score: 0,
    lives: INITIAL_LIVES,
    difficultyLevel: 1,
    elapsedMs: 0,
    nextEntityId: 1,
    fireCooldownMs: 0,
    spawnCooldownMs: 0,
    player: {
      id: 0,
      x: (bounds.width - PLAYER_SIZE.width) / 2,
      y: bounds.height - PLAYER_SIZE.height - 46,
      ...PLAYER_SIZE,
      speed: PLAYER_SPEED,
      invulnerableMs: 0,
    },
    enemies: [],
    projectiles: [],
    bounds,
  };
}

export function startSession(session: GameSession): GameSession {
  return { ...session, phase: 'playing' };
}

export function restartSession(session: GameSession): GameSession {
  return startSession(createInitialSession(session.bounds));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function spawnEnemy(session: GameSession, random: () => number): GameSession {
  const difficulty = session.difficultyLevel;
  const enemy = {
    id: session.nextEntityId,
    x: random() * Math.max(0, session.bounds.width - ENEMY_SIZE.width),
    y: -ENEMY_SIZE.height,
    ...ENEMY_SIZE,
    vx: (random() - 0.5) * (20 + difficulty * 8),
    vy: 80 + difficulty * 14,
    hp: 1,
  };

  return {
    ...session,
    nextEntityId: session.nextEntityId + 1,
    enemies: [...session.enemies, enemy],
  };
}

export function step(
  session: GameSession,
  input: InputState = EMPTY_INPUT,
  deltaMs: number,
  random: () => number = Math.random,
): GameSession {
  if (session.phase !== 'playing') {
    return session.phase === 'ready' && input === EMPTY_INPUT ? session : session;
  }

  const safeDeltaMs = Math.min(100, Math.max(0, deltaMs));
  const dt = safeDeltaMs / 1000;
  const elapsedMs = session.elapsedMs + safeDeltaMs;
  const difficultyLevel = difficultyFor(elapsedMs, session.score);
  const horizontal = Number(input.right) - Number(input.left);
  const vertical = Number(input.down) - Number(input.up);
  const player = {
    ...session.player,
    x: clamp(
      session.player.x + horizontal * session.player.speed * dt,
      0,
      session.bounds.width - session.player.width,
    ),
    y: clamp(
      session.player.y + vertical * session.player.speed * dt,
      0,
      session.bounds.height - session.player.height,
    ),
    invulnerableMs: Math.max(0, session.player.invulnerableMs - safeDeltaMs),
  };

  let next: GameSession = {
    ...session,
    elapsedMs,
    difficultyLevel,
    player,
    fireCooldownMs: Math.max(0, session.fireCooldownMs - safeDeltaMs),
    spawnCooldownMs: Math.max(0, session.spawnCooldownMs - safeDeltaMs),
    enemies: session.enemies
      .map((enemy) => ({
        ...enemy,
        x: enemy.x + enemy.vx * dt,
        y: enemy.y + enemy.vy * dt,
      }))
      .filter((enemy) => enemy.y <= session.bounds.height + enemy.height),
    projectiles: session.projectiles
      .map((projectile) => ({ ...projectile, y: projectile.y + projectile.vy * dt }))
      .filter((projectile) => projectile.y + projectile.height >= 0),
  };

  const escaped = next.enemies.filter((enemy) => enemy.y > next.bounds.height);
  if (escaped.length > 0) {
    next = {
      ...next,
      lives: Math.max(0, next.lives - escaped.length),
      enemies: next.enemies.filter((enemy) => enemy.y <= next.bounds.height),
    };
  }

  if (input.fire && next.fireCooldownMs <= 0) {
    next = {
      ...next,
      fireCooldownMs: FIRE_INTERVAL_MS,
      nextEntityId: next.nextEntityId + 1,
      projectiles: [
        ...next.projectiles,
        {
          id: next.nextEntityId,
          x: next.player.x + next.player.width / 2 - 2.5,
          y: next.player.y - 12,
          width: 5,
          height: 12,
          vy: -PROJECTILE_SPEED,
          damage: 1,
        },
      ],
    };
  }

  if (next.spawnCooldownMs <= 0) {
    next = {
      ...spawnEnemy(next, random),
      spawnCooldownMs: Math.max(160, 520 - next.difficultyLevel * 35),
    };
  }

  next = resolveCollisions(next);
  return next.lives === 0 ? { ...next, phase: 'game-over' } : next;
}
