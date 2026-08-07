export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function circleHit(first, second) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const radius = first.radius + second.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function isValidName(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 16 && /^[A-Za-z0-9 _-]+$/.test(value);
}

export function isPlausibleScore(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
}

export function getWaveForScore(score) {
  return Math.max(1, Math.floor(Math.max(0, score) / 750) + 1);
}

export function getDifficulty(wave) {
  const safeWave = Math.max(1, wave);
  return {
    spawnDelay: Math.max(280, 1120 - (safeWave - 1) * 62),
    enemySpeed: Math.min(190, 54 + (safeWave - 1) * 8),
    fireChance: Math.min(0.0018, 0.0003 + (safeWave - 1) * 0.00012),
  };
}

export function createInitialState() {
  return {
    phase: 'ready',
    score: 0,
    lives: 3,
    playerX: WORLD_WIDTH / 2,
    playerY: WORLD_HEIGHT - 74,
    enemyCount: 0,
    projectileCount: 0,
  };
}
