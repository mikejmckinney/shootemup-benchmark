export const NAME_PATTERN = /^[A-Za-z0-9 _.-]+$/;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 16;
export const MIN_SCORE = 0;
export const MAX_SCORE = 100_000_000;

export function validatePlayerName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH || trimmed.length > MAX_NAME_LENGTH) {
    return `Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters.`;
  }
  if (!NAME_PATTERN.test(trimmed)) {
    return 'Name may only contain letters, numbers, spaces, underscores, dots, and hyphens.';
  }
  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score)) {
    return 'Score must be an integer.';
  }
  if (score < MIN_SCORE || score > MAX_SCORE) {
    return `Score must be between ${MIN_SCORE} and ${MAX_SCORE}.`;
  }
  return null;
}

export function normalizePlayerName(name: string): string {
  return name.trim();
}
