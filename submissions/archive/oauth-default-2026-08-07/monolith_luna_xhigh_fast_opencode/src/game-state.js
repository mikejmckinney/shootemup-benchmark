export const MAX_SCORE = 2147483647;
export const MAX_NAME_LENGTH = 16;

export function createGameState(width = 720, height = 520) {
  return {
    phase: "ready",
    score: 0,
    lives: 3,
    playerX: width / 2,
    playerY: height - 74,
    enemyCount: 0,
    projectileCount: 0,
  };
}

export function clampName(value) {
  return String(value ?? "").trim();
}

export function isValidName(value) {
  const name = clampName(value);
  return name.length >= 1 && name.length <= MAX_NAME_LENGTH && /^[a-z0-9 _-]+$/i.test(name);
}

export function isPlausibleScore(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function difficultyForScore(score) {
  const safeScore = Math.max(0, Number(score) || 0);
  return Math.min(12, 1 + Math.floor(safeScore / 450));
}

export function movePlayer(position, direction, dt, bounds) {
  const speed = 340;
  return {
    x: Math.min(bounds.width - 26, Math.max(26, position.x + direction.x * speed * dt)),
    y: Math.min(bounds.height - 30, Math.max(30, position.y + direction.y * speed * dt)),
  };
}

export function hitTest(a, b, radius) {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return x * x + y * y <= radius * radius;
}
