export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 600;
export const MAX_SCORE = 2147483647;

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function rectanglesOverlap(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function entityRect(entity) {
  return {
    x: entity.x - entity.width / 2,
    y: entity.y - entity.height / 2,
    width: entity.width,
    height: entity.height
  };
}

export function isValidPlayerName(value) {
  const name = String(value ?? "");
  const length = Array.from(name).length;
  return (
    name === name.trim() &&
    length >= 1 &&
    length <= 16 &&
    !/[\u0000-\u001f\u007f]/u.test(name)
  );
}

export function isPlausibleScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function difficultyForElapsed(seconds) {
  return 1 + Math.floor(Math.max(0, seconds) / 18);
}

export function formatScore(value) {
  const score = isPlausibleScore(value) ? value : 0;
  const padded = String(score).padStart(6, "0");
  if (score < 1000) {
    return padded;
  }
  return padded.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}
