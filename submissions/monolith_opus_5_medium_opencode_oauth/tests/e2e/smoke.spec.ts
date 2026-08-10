import { expect, test } from '@playwright/test';

/**
 * Black-box smoke test. Runs against BASE_URL (defaults to the local preview
 * server configured in playwright.config.ts) and exercises the same UI a human
 * would use, including a real Supabase round trip.
 */

const uniqueName = () => `T${Date.now().toString().slice(-8)}`;

test('boots, plays, and submits a score to the live leaderboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  await expect(page.locator('[data-testid="game-canvas"]')).toBeVisible();
  await expect(page.locator('[data-testid="score"]')).toHaveText('0');
  await expect(page.locator('[data-testid="mute-button"]')).toBeVisible();
  await expect(page.locator('[data-testid="touch-controls"]')).toHaveCount(1);

  // Leaderboard resolves out of the loading state.
  await expect
    .poll(async () => (await page.locator('[data-testid="leaderboard"]').innerText()).includes('Loading'), {
      timeout: 15000,
    })
    .toBe(false);

  await page.locator('[data-testid="start-button"]').click();
  await expect.poll(async () => page.evaluate(() => window.__NEON_BARRAGE__.getState().phase)).toBe('playing');

  // Keyboard controls move the ship and fire.
  const before = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(350);
  await page.keyboard.up('ArrowLeft');
  const after = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  expect(after.playerX).toBeLessThan(before.playerX);

  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  await page.keyboard.up('Space');
  await expect
    .poll(async () => page.evaluate(() => window.__NEON_BARRAGE__.getState().projectileCount))
    .toBeGreaterThan(0);

  // Enemies spawn (escalating difficulty).
  await expect
    .poll(async () => page.evaluate(() => window.__NEON_BARRAGE__.getState().enemyCount), { timeout: 10000 })
    .toBeGreaterThan(0);

  // Test adapter drives the normal game-over UI.
  const score = 4321;
  await page.evaluate((s) => window.__NEON_BARRAGE__.endGameForTest(s), score);
  await expect(page.locator('[data-testid="player-name"]')).toBeVisible();
  expect(await page.evaluate(() => window.__NEON_BARRAGE__.getState().score)).toBe(score);

  // Client-side validation state.
  await page.locator('[data-testid="player-name"]').fill('');
  await page.locator('[data-testid="submit-score"]').click();
  await expect(page.locator('#form-msg')).toHaveClass(/error/);

  // Real submission round trip.
  const name = uniqueName();
  await page.locator('[data-testid="player-name"]').fill(name);
  await page.locator('[data-testid="submit-score"]').click();
  await expect(page.locator('#form-msg')).toHaveClass(/ok/, { timeout: 20000 });
  await expect(page.locator('[data-testid="leaderboard"]')).toContainText(name, { timeout: 20000 });

  // Persists across a reload.
  await page.reload();
  await expect(page.locator('[data-testid="leaderboard"]')).toContainText(name, { timeout: 20000 });

  expect(errors).toEqual([]);
});

test('mute control toggles and is reflected in the DOM', async ({ page }) => {
  await page.goto('/');
  const mute = page.locator('[data-testid="mute-button"]');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
});

test('touch controls are visible and playable on a narrow viewport', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('[data-testid="touch-controls"]')).toBeVisible();
  await page.locator('[data-testid="start-button"]').click();
  const before = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  await page.locator('.tbtn.left').dispatchEvent('pointerdown', { pointerId: 1 });
  await page.waitForTimeout(400);
  await page.locator('.tbtn.left').dispatchEvent('pointerup', { pointerId: 1 });
  const after = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  expect(after.playerX).toBeLessThan(before.playerX);
  await ctx.close();
});
