import { expect, test } from '@playwright/test';

test.describe('Neon Barrage gameplay contract', () => {
  test('exposes the playable canvas, HUD, and adapter game-over path', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="game-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="start-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="score"]')).toHaveText('0');
    await expect(page.locator('[data-testid="lives"]')).toHaveText('3');

    await page.locator('[data-testid="start-button"]').click();
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await page.waitForTimeout(100);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Space');

    await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(321));
    await expect(page.getByText(/game over/i)).toBeVisible();
    await expect(page.locator('.final-score')).toHaveText('321');
    await page.getByRole('button', { name: /restart/i }).click();
    await expect(page.locator('[data-testid="score"]')).toHaveText('0');
    await expect(page.locator('[data-testid="lives"]')).toHaveText('3');
  });
});
