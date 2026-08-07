const NAME_RE = /^[A-Za-z0-9 _.-]+$/;

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 16) {
    return 'Name must be 1–16 characters.';
  }
  if (!NAME_RE.test(trimmed)) {
    return 'Use letters, numbers, spaces, _ . - only.';
  }
  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score) || score < 0 || score > 100_000_000) {
    return 'Score must be a plausible non-negative integer.';
  }
  return null;
}
