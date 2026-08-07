export const WORLD = Object.freeze({ width: 960, height: 600 });

export const MAX_SCORE = 1_000_000_000;

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function circlesOverlap(first, second) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const distance = first.radius + second.radius;
  return dx * dx + dy * dy <= distance * distance;
}

export function difficultyForScore(score) {
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const level = 1 + Math.floor(safeScore / 500);

  return {
    level,
    spawnInterval: Math.max(0.28, 1.02 - (level - 1) * 0.055),
    enemySpeed: 54 + (level - 1) * 9,
    maxEnemies: Math.min(16, 4 + Math.floor((level - 1) * 0.7)),
    fireInterval: Math.max(0.62, 1.8 - (level - 1) * 0.08)
  };
}

export function isValidName(value) {
  if (typeof value !== 'string') {
    return false;
  }

  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  const name = value.trim();
  const length = Array.from(name).length;
  return length >= 1 && length <= 16;
}

export function isValidScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function normalizeScore(value) {
  if (!Number.isFinite(Number(value))) {
    return 0;
  }

  return clamp(Math.floor(Number(value)), 0, MAX_SCORE);
}
