export const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,15}$/;
export const MAX_SCORE = 100_000_000;

export function normalizeName(value) {
  return String(value ?? "").trim();
}

export function isValidPlayerName(value) {
  const name = normalizeName(value);
  return name.length >= 1 && name.length <= 16 && NAME_PATTERN.test(name);
}

export function isPlausibleScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function validateSubmission(name, score) {
  const normalizedName = normalizeName(name);
  return {
    name: normalizedName,
    score,
    valid: isValidPlayerName(normalizedName) && isPlausibleScore(score),
    nameError: isValidPlayerName(normalizedName)
      ? ""
      : "Use 1–16 letters, numbers, spaces, hyphens, or underscores.",
    scoreError: isPlausibleScore(score) ? "" : "That score is not valid."
  };
}

export function difficultyForScore(score) {
  const safeScore = isPlausibleScore(score) ? score : 0;
  const level = 1 + Math.floor(safeScore / 600);
  return {
    level,
    spawnInterval: Math.max(0.34, 1.1 - (level - 1) * 0.07),
    enemySpeed: 72 + Math.min(220, (level - 1) * 12)
  };
}

export function rectanglesOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function formatScore(score) {
  return String(Math.max(0, Math.trunc(score))).padStart(6, "0");
}
