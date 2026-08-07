import { expect, test } from '@playwright/test';

test.describe('Neon Barrage accessibility and device contract', () => {
  test('exposes touch controls and keyboard-focusable named controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('[data-testid="touch-controls"]')).toBeVisible();
    await expect(page.locator('[data-testid="mute-button"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Move left' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Game status' })).toBeVisible();

    await page.locator('[data-testid="start-button"]').focus();
    await expect(page.locator('[data-testid="start-button"]')).toBeFocused();
    await page.locator('[data-testid="mute-button"]').focus();
    await expect(page.locator('[data-testid="mute-button"]')).toBeFocused();

    await page.locator('[data-testid="start-button"]').click();
    const initialX = await page.evaluate(() => window.__NEON_BARRAGE__.getState().playerX);
    const rightButton = page.getByRole('button', { name: 'Move right' });
    await rightButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
    const movedX = await page.evaluate(() => window.__NEON_BARRAGE__.getState().playerX);
    expect(movedX).toBeGreaterThan(initialX);

    const fireButton = page.getByRole('button', { name: 'Fire' });
    await fireButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__NEON_BARRAGE__.getState().projectileCount)).toBeGreaterThan(0);

    await page.locator('[data-testid="mute-button"]').click();
    await expect(page.locator('[data-testid="mute-button"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('keeps the canvas usable with reduced motion enabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('[data-testid="game-canvas"]')).toBeVisible();
    await page.locator('[data-testid="start-button"]').click();
    await expect(page.locator('[data-testid="score"]')).toHaveText('0');
  });
});
