export type Box = { x: number; y: number; width: number; height: number };

export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function difficultyFor(elapsedMs: number, score: number): number {
  return Math.min(12, 1 + Math.floor(elapsedMs / 18_000) + Math.floor(score / 3_000));
}

export function spawnDelayFor(level: number): number {
  return Math.max(260, 980 - level * 62);
}

export function normalizeTestScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.min(10_000_000, Math.floor(value));
}
