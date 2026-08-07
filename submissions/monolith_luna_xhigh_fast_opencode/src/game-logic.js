export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function sanitizeName(value) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 16);
}

export function isValidPlayerName(value) {
  return /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,15}$/.test(value);
}

export function isPlausibleScore(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
}

export function waveForScore(score) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, score) / 450)) + 1);
}
