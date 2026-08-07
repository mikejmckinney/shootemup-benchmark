export const MAX_SCORE = 2147483647;

export function isValidName(value) {
  return typeof value === 'string' && value.length >= 1 && value.length <= 16 && value.trim().length > 0 && /^[A-Za-z0-9 _-]+$/.test(value);
}

export function isValidScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function nextSpawnDelay(elapsedSeconds) {
  const difficulty = Math.min(1, Math.max(0, elapsedSeconds) * 0.009);
  return Math.max(310, 930 - difficulty * 620);
}

export function circleHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function damageForEnemy(enemy) {
  return enemy.type === 'brute' ? 2 : 1;
}
