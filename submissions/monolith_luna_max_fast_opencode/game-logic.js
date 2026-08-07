export const MAX_NAME_LENGTH = 16;
export const MAX_SCORE = 1_000_000_000;

export function normalizeName(value) {
  return String(value ?? "").trim();
}

export function validateName(value) {
  const name = normalizeName(value);
  if (name.length < 1) return { valid: false, value: name, error: "Enter a pilot tag first." };
  if (name.length > MAX_NAME_LENGTH) return { valid: false, value: name, error: "Pilot tags can be 16 characters maximum." };
  return { valid: true, value: name, error: "" };
}

export function validateScore(value) {
  const score = Number(value);
  return Number.isSafeInteger(score) && score >= 0 && score <= MAX_SCORE;
}

export function circlesOverlap(first, second) {
  const x = first.x - second.x;
  const y = first.y - second.y;
  const radius = first.radius + second.radius;
  return x * x + y * y <= radius * radius;
}

export function difficultyFor(score, elapsedSeconds) {
  return Math.max(1, Math.min(99, 1 + Math.floor(score / 300) + Math.floor(elapsedSeconds / 24)));
}

export function spawnIntervalFor(score, elapsedSeconds) {
  return Math.max(0.3, 1.02 - difficultyFor(score, elapsedSeconds) * 0.055);
}

export function sortLeaderboard(entries) {
  return [...entries]
    .filter((entry) => entry && typeof entry.name === "string" && validateScore(entry.score))
    .sort((a, b) => Number(b.score) - Number(a.score) || String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
    .slice(0, 10);
}
