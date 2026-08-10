// End-to-end verification against a deployed (or local) build.
//   BASE_URL=https://... node e2e/verify.mjs
// Drives real Chromium through the same UI a player uses, including a live
// Supabase submit + reload round trip.

import { chromium, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const NAME = `E2E${String(Date.now()).slice(-6)}`;
const results = [];

// Poll with page.evaluate: the site's CSP forbids unsafe-eval, which is what
// Playwright's waitForFunction relies on.
async function until(page, fn, arg, timeout = 15000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(fn, arg)) return true;
    if (Date.now() > deadline) return false;
    await page.waitForTimeout(250);
  }
}

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });

/* ---------- desktop ---------- */
const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await desktop.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));

const response = await page.goto(BASE_URL, { waitUntil: 'load' });
check('production responds 200', response.status() === 200, `status ${response.status()}`);

for (const id of [
  'game-canvas', 'start-button', 'score', 'lives', 'mute-button',
  'leaderboard', 'touch-controls',
]) {
  check(`selector [data-testid="${id}"] exists`, await page.locator(`[data-testid="${id}"]`).count() === 1);
}

check('score starts at 0', (await page.locator('[data-testid="score"]').textContent()) === '0');
check('lives start at 3', (await page.locator('[data-testid="lives"]').textContent()) === '3');

// Gameplay.
await page.locator('[data-testid="start-button"]').click();
await page.keyboard.down('Space');
await page.waitForTimeout(2500);
await page.keyboard.up('Space');
let state = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
check('phase is playing', state.phase === 'playing');
check('enemies spawned', state.enemyCount > 0, `enemyCount=${state.enemyCount}`);
check('projectiles exist', state.projectileCount > 0, `projectileCount=${state.projectileCount}`);

// Movement.
const beforeX = state.playerX;
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(400);
await page.keyboard.up('ArrowLeft');
const afterX = (await page.evaluate(() => window.__NEON_BARRAGE__.getState())).playerX;
check('arrow keys move the ship', afterX < beforeX, `${beforeX} -> ${afterX}`);

// Mute toggle.
const mute = page.locator('[data-testid="mute-button"]');
await mute.click();
check('mute toggles on', (await mute.getAttribute('aria-pressed')) === 'true');
await mute.click();
check('mute toggles off', (await mute.getAttribute('aria-pressed')) === 'false');

// Validation path.
state = await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(31337));
check('adapter reaches game over', state.phase === 'gameover' && state.score === 31337, JSON.stringify(state));
await page.waitForTimeout(400); // let the next animation frame sync the HUD
check('score HUD shows adapter score', (await page.locator('[data-testid="score"]').textContent()) === '31337');
check('submit form visible on game over', await page.locator('[data-testid="player-name"]').isVisible());

await page.locator('[data-testid="player-name"]').fill('   ');
await page.locator('[data-testid="submit-score"]').click();
await page.waitForTimeout(300);
check('blank name is rejected client-side',
  (await page.locator('#submit-status').getAttribute('data-tone')) === 'error',
  await page.locator('#submit-status').textContent());

// Real Supabase round trip.
await page.locator('[data-testid="player-name"]').fill(NAME);
await page.locator('[data-testid="submit-score"]').click();
await until(page, () => document.getElementById('submit-status')?.dataset.tone !== undefined);
check('submission succeeded',
  (await page.locator('#submit-status').getAttribute('data-tone')) === 'success',
  await page.locator('#submit-status').textContent());

await page.waitForTimeout(1200);
check('new entry appears on the board',
  (await page.locator('[data-testid="leaderboard"]').textContent()).includes(NAME));

// Persistence across reload.
await page.reload({ waitUntil: 'load' });
await until(page, (name) => document.querySelector('[data-testid="leaderboard"]')?.textContent?.includes(name), NAME);
check('entry persists after reload',
  (await page.locator('[data-testid="leaderboard"]').textContent()).includes(NAME));

const scores = (await page.locator('[data-testid="leaderboard"] .board__score').allTextContents())
  .map((s) => Number(s.replace(/,/g, '')));
check('board shows at most 10 rows', scores.length > 0 && scores.length <= 10, `rows=${scores.length}`);
check('board is sorted descending', JSON.stringify([...scores].sort((a, b) => b - a)) === JSON.stringify(scores),
  scores.join(','));

// No service-role key in the shipped bundle.
const bundle = await page.evaluate(async () => {
  const files = ['/src/config.js', '/src/main.js', '/src/leaderboard.js'];
  const texts = await Promise.all(files.map((f) => fetch(f).then((r) => r.text())));
  return texts.join('\n');
});
check('no service_role key in shipped source', !/service_role/.test(bundle));

check('no uncaught page errors', consoleErrors.length === 0, consoleErrors.join(' | '));

/* ---------- mobile ---------- */
const mobile = await browser.newContext({ ...devices['Pixel 5'] });
const mp = await mobile.newPage();
await mp.goto(BASE_URL, { waitUntil: 'load' });
check('touch controls visible on narrow viewport', await mp.locator('[data-testid="touch-controls"]').isVisible());
await mp.locator('[data-testid="start-button"]').click();
const mBefore = (await mp.evaluate(() => window.__NEON_BARRAGE__.getState())).playerX;
await mp.locator('[data-dir="right"]').dispatchEvent('pointerdown');
await mp.waitForTimeout(500);
await mp.locator('[data-dir="right"]').dispatchEvent('pointerup');
const mAfter = (await mp.evaluate(() => window.__NEON_BARRAGE__.getState())).playerX;
check('touch d-pad moves the ship', mAfter > mBefore, `${mBefore} -> ${mAfter}`);
check('canvas fits the mobile viewport',
  (await mp.locator('[data-testid="game-canvas"]').boundingBox()).width <= 393);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
