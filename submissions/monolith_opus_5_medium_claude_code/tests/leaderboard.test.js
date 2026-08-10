import { describe, it, expect, vi } from 'vitest';
import { createLeaderboard, validateName, validateScore } from '../src/leaderboard.js';

const config = { url: 'https://example.supabase.co', anonKey: 'anon-key' };

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('name validation', () => {
  it('accepts 1-16 character names and trims them', () => {
    expect(validateName('a')).toEqual({ ok: true, value: 'a' });
    expect(validateName('  Pilot One  ')).toEqual({ ok: true, value: 'Pilot One' });
    expect(validateName('ABCDEFGHIJKLMNOP')).toEqual({ ok: true, value: 'ABCDEFGHIJKLMNOP' });
  });

  it('rejects empty, oversized and unsafe names', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('   ').ok).toBe(false);
    expect(validateName('ABCDEFGHIJKLMNOPQ').ok).toBe(false);
    expect(validateName('<script>').ok).toBe(false);
    expect(validateName('drop;--').ok).toBe(false);
    expect(validateName(null).ok).toBe(false);
  });
});

describe('score validation', () => {
  it('accepts non-negative integers in range', () => {
    expect(validateScore(0)).toEqual({ ok: true, value: 0 });
    expect(validateScore('1500')).toEqual({ ok: true, value: 1500 });
  });

  it('rejects negatives, fractions, NaN and absurd values', () => {
    expect(validateScore(-1).ok).toBe(false);
    expect(validateScore(1.5).ok).toBe(false);
    expect(validateScore('abc').ok).toBe(false);
    expect(validateScore(Infinity).ok).toBe(false);
    expect(validateScore(10000001).ok).toBe(false);
  });
});

describe('leaderboard client', () => {
  it('requests the top N in descending score order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ name: 'A', score: 10 }]));
    const board = createLeaderboard({ ...config, fetchImpl });
    const rows = await board.top(10);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/rest/v1/leaderboard');
    expect(url).toContain('order=score.desc');
    expect(url).toContain('limit=10');
    expect(init.headers.apikey).toBe('anon-key');
    expect(rows).toHaveLength(1);
  });

  it('posts a validated row on submit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ name: 'Pilot', score: 700 }]));
    const board = createLeaderboard({ ...config, fetchImpl });
    const saved = await board.submit('  Pilot  ', 700);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Pilot', score: 700 });
    expect(saved).toEqual({ name: 'Pilot', score: 700 });
  });

  it('refuses to send invalid input to the network', async () => {
    const fetchImpl = vi.fn();
    const board = createLeaderboard({ ...config, fetchImpl });
    await expect(board.submit('', 10)).rejects.toThrow(/1-16/);
    await expect(board.submit('Pilot', -5)).rejects.toThrow(/out of range/);
    await expect(board.submit('Pilot', 3.3)).rejects.toThrow(/whole number/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces server rejections with the database message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ message: 'new row violates check constraint' }, false, 400),
    );
    const board = createLeaderboard({ ...config, fetchImpl });
    await expect(board.submit('Pilot', 10)).rejects.toThrow(/check constraint/);
  });

  it('turns transport failures into a friendly network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const board = createLeaderboard({ ...config, fetchImpl });
    await expect(board.top()).rejects.toThrow(/Network unavailable/);
  });

  it('never sends a service-role style key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const board = createLeaderboard({ ...config, fetchImpl });
    await board.top();
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.stringify(init.headers)).not.toMatch(/service_role/);
  });
});
