import { expect, test } from '@playwright/test';

const productionUrl = process.env.PLAYWRIGHT_BASE_URL ?? process.env.CLOUDFLARE_URL;

test.describe('Neon Barrage production release gate', () => {
  test.skip(!productionUrl, 'Set PLAYWRIGHT_BASE_URL or CLOUDFLARE_URL to run production verification.');

  test('passes the public game and leaderboard round trip', async ({ page, request }) => {
    const response = await request.get(productionUrl as string);
    expect(response.status()).toBe(200);

    await page.goto(productionUrl as string);
    for (const selector of [
      '[data-testid="game-canvas"]',
      '[data-testid="start-button"]',
      '[data-testid="score"]',
      '[data-testid="lives"]',
      '[data-testid="mute-button"]',
      '[data-testid="leaderboard"]',
      '[data-testid="touch-controls"]',
    ]) {
      await expect(page.locator(selector)).toBeAttached();
    }

    await page.locator('[data-testid="start-button"]').click();
    await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(123456));
    await expect(page.locator('.final-score')).toHaveText('123456');

    const name = `NB${Date.now().toString(36)}`;
    await page.locator('[data-testid="player-name"]').fill(name);
    await page.locator('[data-testid="submit-score"]').click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    const scores = await page.locator('[data-testid="leaderboard"] strong').allTextContents();
    expect(scores.map(Number)).toEqual([...scores.map(Number)].sort((a, b) => b - a));

    await page.reload();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });
});
