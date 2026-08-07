export const BOARD_WIDTH = 900;
export const BOARD_HEIGHT = 600;
export const MAX_SCORE = 2_147_483_647;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 1 || name.length > 16) return null;
  if (/\p{Cc}/u.test(name)) return null;
  return name;
}

export function isPlausibleScore(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function circlesOverlap(first, second) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const radius = first.radius + second.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function difficultyFor(score, elapsedSeconds = 0) {
  return Math.min(12, 1 + Math.floor(score / 650) + Math.floor(elapsedSeconds / 28));
}

export function spawnDelayFor(difficulty) {
  return Math.max(300, 1075 - difficulty * 64);
}

export function scoreForEnemy(type) {
  return type === "hunter" ? 180 : type === "weaver" ? 125 : 100;
}

export function formatScore(score) {
  return Math.max(0, Math.floor(score)).toLocaleString("en-US");
}
