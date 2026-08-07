import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const migrationDirectory = join(testDirectory, '..', 'supabase', 'migrations');

function migrationSql() {
  const file = readdirSync(migrationDirectory).find((name) =>
    name.endsWith('_create_leaderboard.sql'),
  );
  assert.ok(file, 'create_leaderboard migration is missing');
  return readFileSync(join(migrationDirectory, file), 'utf8');
}

test('migration declares the database validation and least-privilege surface', () => {
  const sql = migrationSql();

  assert.match(sql, /create\s+table\s+public\.leaderboard/i);
  assert.match(sql, /id\s+bigint\s+generated\s+always\s+as\s+identity/i);
  assert.match(sql, /name\s+text\s+not\s+null/i);
  assert.match(sql, /score\s+integer\s+not\s+null/i);
  assert.match(sql, /char_length\(name\)\s+between\s+1\s+and\s+16/i);
  assert.match(sql, /name\s+~\s*'\^\[A-Za-z0-9\]\[A-Za-z0-9 _-\]\{0,15\}\$'/i);
  assert.match(sql, /score\s+between\s+0\s+and\s+100000000/i);
  assert.match(sql, /alter\s+table\s+public\.leaderboard\s+enable\s+row\s+level\s+security/i);
  assert.match(sql, /grant\s+select\s+on\s+table\s+public\.leaderboard\s+to\s+anon,\s*authenticated/i);
  assert.match(sql, /grant\s+insert\s*\(\s*name\s*,\s*score\s*\)\s+on\s+table\s+public\.leaderboard\s+to\s+anon,\s*authenticated/i);
  assert.match(sql, /create\s+policy\s+"leaderboard_public_read"[\s\S]+for\s+select[\s\S]+to\s+anon,\s*authenticated[\s\S]+using\s*\(true\)/i);
  assert.match(sql, /create\s+policy\s+"leaderboard_public_insert"[\s\S]+for\s+insert[\s\S]+to\s+anon,\s*authenticated[\s\S]+with\s+check\s*\(true\)/i);
  assert.doesNotMatch(sql, /grant\s+[^;]*(?:update|delete)[^;]*\s+to\s+(?:anon|authenticated)/i);
});
