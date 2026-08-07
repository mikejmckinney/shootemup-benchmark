export const MAX_SCORE = 10_000_000;

export function isValidName(name: string): boolean {
  return /^[A-Za-z0-9 _-]{1,16}$/.test(name.trim());
}

export function isPlausibleScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= MAX_SCORE;
}

export function difficultyFor(score: number, elapsedSeconds: number) {
  return Math.min(10, 1 + Math.floor(score / 800) + Math.floor(elapsedSeconds / 30));
}

export function circlesCollide(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
}
