import { expect, test } from '@playwright/test';

test('exposes a playable arena and persistent score flow', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.getByTestId('score')).toHaveText('000000');
  await expect(page.getByTestId('lives')).toContainText('◆');
  await expect(page.getByTestId('mute-button')).toBeVisible();
  await expect(page.getByTestId('leaderboard')).toBeVisible();

  await page.getByTestId('start-button').click();
  await expect.poll(() => page.evaluate(() => window.__NEON_BARRAGE__.getState().phase)).toBe('playing');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(180);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  await page.keyboard.up('Space');
  await expect.poll(() => page.evaluate(() => window.__NEON_BARRAGE__.getState().projectileCount)).toBeGreaterThan(0);

  if (testInfo.project.name === 'desktop-chromium') {
    const callsign = `E2E${Date.now().toString().slice(-10)}`;
    await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(7654));
    await expect(page.getByTestId('player-name')).toBeVisible();
    await page.getByTestId('player-name').fill(callsign);
    await page.getByTestId('submit-score').click();
    await expect(page.locator('[data-form-status]')).toHaveText('SCORE TRANSMITTED');
    await expect(page.getByTestId('leaderboard')).toContainText(callsign);
    await page.reload();
    await expect(page.getByTestId('leaderboard')).toContainText(callsign);
  } else {
    await expect(page.getByTestId('touch-controls')).toBeVisible();
  }
});

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => { phase: string; projectileCount: number };
      endGameForTest: (score: number) => void;
    };
  }
}
