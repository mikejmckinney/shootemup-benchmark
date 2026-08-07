import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createLeaderboardRequestGuard,
  leaderboardLoadSucceeded,
  validatePlayerName,
  validateScore,
} from '../src/leaderboard';

const migration = readFileSync(
  new URL('../supabase/migrations/20260806000000_create_leaderboard.sql', import.meta.url),
  'utf8',
);
const forwardMigrationUrl = new URL(
  '../supabase/migrations/20260806000001_align_leaderboard_validation.sql',
  import.meta.url,
);

describe('leaderboard validation', () => {
  it('trims and accepts a 1-16 character name', () => {
    expect(validatePlayerName('  NOVA-7  ')).toEqual({ ok: true, value: 'NOVA-7' });
    expect(validatePlayerName('1234567890123456').ok).toBe(true);
  });

  it('rejects blank, overlong, and control-character names', () => {
    expect(validatePlayerName('   ').ok).toBe(false);
    expect(validatePlayerName('12345678901234567').ok).toBe(false);
    expect(validatePlayerName('pilot\nname').ok).toBe(false);
    expect(validatePlayerName('pilot\u0085name').ok).toBe(false);
  });

  it('preserves allowed spaces inside a trimmed name', () => {
    expect(validatePlayerName('  NOVA 7  ')).toEqual({ ok: true, value: 'NOVA 7' });
  });

  it('accepts only bounded non-negative integer scores', () => {
    expect(validateScore(0).ok).toBe(true);
    expect(validateScore(2_000_000_001).ok).toBe(false);
    expect(validateScore(2.5).ok).toBe(false);
    expect(validateScore(-1).ok).toBe(false);
  });
});

describe('leaderboard request ordering', () => {
  it('does not render an older response after a newer refresh begins', () => {
    const guard = createLeaderboardRequestGuard();
    const rendered: string[] = [];
    const initialRequest = guard.begin();
    const refreshRequest = guard.begin();

    if (guard.isCurrent(refreshRequest)) {
      rendered.push('submitted rows');
    }
    if (guard.isCurrent(initialRequest)) {
      rendered.push('stale initial rows');
    }

    expect(rendered).toEqual(['submitted rows']);
  });
});

describe('leaderboard load result semantics', () => {
  it('distinguishes current errors from current success and stale responses', () => {
    expect(leaderboardLoadSucceeded(true, true)).toBe(true);
    expect(leaderboardLoadSucceeded(true, false)).toBe(false);
    expect(leaderboardLoadSucceeded(false, false)).toBe(true);
  });
});

describe('leaderboard migration validation alignment', () => {
  it('rejects the same control-character class and trims browser whitespace forms', () => {
    expect(migration).toContain("player_name !~ '[[:cntrl:]]'");
    expect(migration).not.toContain("player_name !~ '[\\r\\n\\t]'");
    expect(migration.match(/btrim\(\s*player_name,/g)).toHaveLength(2);
    expect(migration).toContain('chr(160)');
    expect(migration).toContain('chr(65279)');
  });
});

describe('leaderboard forward migration', () => {
  it('replaces legacy checks and policy without weakening anonymous access', () => {
    const forwardMigration = readFileSync(forwardMigrationUrl, 'utf8');

    expect(forwardMigration).toContain(
      'drop constraint if exists leaderboard_name_trimmed',
    );
    expect(forwardMigration).toContain(
      'drop constraint if exists leaderboard_name_no_control',
    );
    expect(forwardMigration).toContain('not valid');
    expect(forwardMigration).toContain(
      'drop policy if exists "public can submit bounded scores"',
    );
    expect(forwardMigration).toContain('create policy "public can submit bounded scores"');
    expect(forwardMigration).toContain('for insert to anon');
    expect(forwardMigration).toContain("player_name !~ '[[:cntrl:]]'");
    expect(forwardMigration).not.toMatch(/for\s+(update|delete)/i);
    expect(forwardMigration).not.toMatch(/grant\s+(update|delete)/i);
    expect(forwardMigration).not.toMatch(/\b(delete|truncate)\s+from\b/i);
  });
});
