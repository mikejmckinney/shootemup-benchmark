export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function circlesCollide(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < (a.r + b.r) ** 2;
}

export function difficultyFor(score, elapsed) {
  const level = 1 + Math.floor(score / 500) + Math.floor(elapsed / 25);
  return { level, spawnEvery: Math.max(260, 950 - level * 55), speed: 95 + level * 9 };
}

export function validScore(score) {
  return Number.isInteger(score) && score >= 0 && score <= 10000000;
}

export function validName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9 _-]{1,16}$/.test(name.trim());
}
