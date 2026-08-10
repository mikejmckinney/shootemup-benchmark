/**
 * End-to-end production smoke test.
 * Usage: node scripts/verify-production.mjs [url]
 * Drives the deployed game exactly like a black-box grader would: start,
 * play, force game over through the test adapter, submit a score, reload,
 * and confirm the entry persisted in the Supabase-backed leaderboard.
 */
import { chromium } from 'playwright';

const URL_ = process.argv[2] ?? 'https://shootemup-bench-monolith-opus-5-medium-opencode.pages.dev/';
const NAME = `BOT${Math.floor(Math.random() * 9000 + 1000)}`;
const SCORE = 1000 + Math.floor(Math.random() * 8000);

const results = [];
const check = (label, ok, extra = '') => {
  results.push({ label, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` :: ${extra}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const res = await page.goto(URL_, { waitUntil: 'networkidle' });
check('HTTP 200', res.status() === 200, `status=${res.status()}`);

for (const sel of [
  'game-canvas', 'start-button', 'score', 'lives', 'mute-button',
  'leaderboard', 'touch-controls',
]) {
  check(`selector [data-testid="${sel}"]`, (await page.locator(`[data-testid="${sel}"]`).count()) > 0);
}

check('no secret key in page', !(await page.content()).includes('service_role'));

// gameplay
await page.click('[data-testid="start-button"]');
await page.waitForTimeout(400);
await page.keyboard.down('Space');
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(1800);
await page.keyboard.up('ArrowLeft');
await page.keyboard.up('Space');
const s1 = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
check('adapter getState shape', ['phase', 'score', 'lives', 'playerX', 'playerY', 'enemyCount', 'projectileCount']
  .every((k) => k in s1), JSON.stringify(s1));
check('phase playing', s1.phase === 'playing');
check('enemies spawned', s1.enemyCount > 0, `enemies=${s1.enemyCount}`);
check('projectiles fired', s1.projectileCount > 0 || s1.score > 0);

// mute toggle
const pressedBefore = await page.getAttribute('[data-testid="mute-button"]', 'aria-pressed');
await page.click('[data-testid="mute-button"]');
const pressedAfter = await page.getAttribute('[data-testid="mute-button"]', 'aria-pressed');
check('mute toggles', pressedBefore !== pressedAfter, `${pressedBefore} -> ${pressedAfter}`);
await page.click('[data-testid="mute-button"]');

// forced game over via adapter
await page.evaluate((s) => window.__NEON_BARRAGE__.endGameForTest(s), SCORE);
await page.waitForSelector('[data-testid="player-name"]', { state: 'visible' });
const s2 = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
check('adapter game over', s2.phase === 'gameover' && s2.score === SCORE, JSON.stringify(s2));
check('score display updated', (await page.textContent('[data-testid="score"]')) === String(SCORE));

// invalid name rejected
await page.fill('[data-testid="player-name"]', '');
await page.click('[data-testid="submit-score"]');
await page.waitForTimeout(300);
check('empty name rejected', (await page.textContent('#submit-msg')).length > 0);

// real submit
await page.fill('[data-testid="player-name"]', NAME);
await page.click('[data-testid="submit-score"]');
await page.waitForFunction(
  () => document.querySelector('#submit-msg')?.classList.contains('ok'),
  undefined,
  { timeout: 15000 },
).catch(() => {});
const msg = await page.textContent('#submit-msg');
check('score submitted', /Saved/.test(msg ?? ''), msg ?? '');

// persistence across reload
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const board = await page.textContent('[data-testid="leaderboard"]');
check('entry persisted after reload', (board ?? '').includes(NAME), (board ?? '').slice(0, 120));
const rows = await page.locator('[data-testid="leaderboard"] li').count();
check('leaderboard renders rows', rows > 0, `rows=${rows}`);
const scores = await page.locator('[data-testid="leaderboard"] .pts').allTextContents();
const nums = scores.map((t) => Number(t.replace(/[^0-9]/g, '')));
check('descending order', nums.every((n, i) => i === 0 || nums[i - 1] >= n), nums.join(','));

// restart works
await page.click('[data-testid="start-button"]');
await page.waitForTimeout(300);
const s3 = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
check('restart resets', s3.phase === 'playing' && s3.score === 0 && s3.lives === 3, JSON.stringify(s3));

// mobile viewport
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(300);
check('touch controls visible on mobile', await page.locator('[data-testid="touch-controls"]').isVisible());

check('no uncaught page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
