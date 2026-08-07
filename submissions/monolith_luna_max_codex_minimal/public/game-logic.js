export const MAX_SCORE = 2_147_483_647;
export const MAX_NAME_LENGTH = 16;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeName(value) {
  return String(value ?? "").trim();
}

export function isValidName(value) {
  const name = sanitizeName(value);
  return name.length >= 1 && name.length <= MAX_NAME_LENGTH && /^[A-Za-z0-9 _-]+$/.test(name);
}

export function isPlausibleScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function circleIntersects(first, second) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const radius = first.radius + second.radius;
  return dx * dx + dy * dy <= radius * radius;
}

export function formatScore(value) {
  const score = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return String(score).padStart(6, "0");
}
