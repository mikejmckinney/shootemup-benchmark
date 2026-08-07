export const WORLD = { width: 720, height: 820 };

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function difficultyFor(score, elapsedSeconds) {
  const level = 1 + Math.floor(score / 500) + Math.floor(elapsedSeconds / 25);
  return {
    level,
    spawnMs: Math.max(260, 920 - level * 52),
    enemySpeed: Math.min(330, 95 + level * 14),
  };
}

export function validName(value) {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 16;
}

export function plausibleScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 10_000_000;
}
