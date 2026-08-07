import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260806_create_leaderboard_entries.sql'),
  'utf8',
);

describe('leaderboard migration contract', () => {
  it('enables RLS and exposes only the public read/insert boundary', () => {
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('grant select');
    expect(migration).toContain('grant insert (name, score)');
    expect(migration).toContain('for select');
    expect(migration).toContain('for insert');
    expect(migration).not.toMatch(/grant\s+(update|delete)/i);
  });

  it('enforces name and score constraints in the database', () => {
    expect(migration).toContain('char_length(name) between 1 and 16');
    expect(migration).toContain("name !~ '[[:cntrl:]]'");
    expect(migration).toContain('score between 0 and 2147483647');
  });
});
