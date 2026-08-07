import { MAX_SCORE } from '../game/config';
import type { ScoreSubmission } from './types';

export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 16;

export type ValidationResult =
  | { ok: true; value: ScoreSubmission }
  | { ok: false; message: string };

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 31) || (code >= 127 && code <= 159);
  });
}

export function validateScoreSubmission(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, message: 'Enter a name before submitting.' };
  }

  const candidate = input as Partial<ScoreSubmission>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const score = candidate.score;
  const nameLength = Array.from(name).length;

  if (nameLength < MIN_NAME_LENGTH || nameLength > MAX_NAME_LENGTH) {
    return { ok: false, message: 'Name must be 1-16 characters.' };
  }
  if (hasControlCharacter(name)) {
    return { ok: false, message: 'Name contains unsupported characters.' };
  }
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, message: 'Score must be a valid non-negative integer.' };
  }

  return { ok: true, value: { name, score } };
}
