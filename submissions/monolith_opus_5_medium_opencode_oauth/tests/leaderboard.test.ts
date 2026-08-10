import { describe, expect, it, vi } from 'vitest';
import { LeaderboardClient, LeaderboardError } from '../src/leaderboard';

const cfg = { url: 'https://example.supabase.co', key: 'sb_publishable_test' };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('LeaderboardClient.top', () => {
  it('requests the top rows in descending score order', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([{ id: '1', name: 'ACE', score: 9, created_at: 'x' }]));
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    const rows = await client.top(10);
    expect(rows).toHaveLength(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('order=score.desc');
    expect(url).toContain('limit=10');
  });

  it('surfaces server errors', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ message: 'nope' }, 500));
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    await expect(client.top()).rejects.toBeInstanceOf(LeaderboardError);
  });

  it('surfaces network errors', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
      throw new TypeError('offline');
    });
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    await expect(client.top()).rejects.toMatchObject({ kind: 'network' });
  });

  it('reports a config error when not configured', async () => {
    const client = new LeaderboardClient({ url: '', key: '' }, (async () => jsonResponse([])) as unknown as typeof fetch);
    await expect(client.top()).rejects.toMatchObject({ kind: 'config' });
  });
});

describe('LeaderboardClient.submit', () => {
  it('trims the name and posts name + score only', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse([{ id: 'a', name: 'ACE', score: 100, created_at: 'x' }], 201),
    );
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    const row = await client.submit('  ACE  ', 100);
    expect(row.name).toBe('ACE');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ name: 'ACE', score: 100 });
  });

  it('rejects invalid names before any network call', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([], 201));
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    await expect(client.submit('', 10)).rejects.toMatchObject({ kind: 'validation' });
    await expect(client.submit('a'.repeat(17), 10)).rejects.toMatchObject({ kind: 'validation' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects implausible scores before any network call', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([], 201));
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    await expect(client.submit('ACE', -1)).rejects.toMatchObject({ kind: 'validation' });
    await expect(client.submit('ACE', 1.5)).rejects.toMatchObject({ kind: 'validation' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an RLS rejection to a validation error', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ code: '42501' }, 403));
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    await expect(client.submit('ACE', 10)).rejects.toMatchObject({ kind: 'validation' });
  });

  it('never sends a service-role style key', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse([{ id: 'a', name: 'A', score: 1, created_at: 'x' }], 201));
    const client = new LeaderboardClient(cfg, fetchMock as unknown as typeof fetch);
    await client.submit('A', 1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe(cfg.key);
    expect(headers.apikey).not.toContain('service_role');
    expect(headers.apikey.startsWith('sb_secret_')).toBe(false);
  });
});
