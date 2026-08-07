import { chromium } from '@playwright/test';

const url = process.argv[2] ?? process.env.CLOUDFLARE_URL;
const forbidden = /SUPABASE_API_KEY|SUPABASE_ACCESS_TOKEN|CLOUDFLARE_API_KEY|CLOUDFLARE_API_TOKEN|service_role/i;

if (!url) {
  console.error('Usage: npm run verify:production -- https://deployed-url.example');
  process.exit(1);
}

async function fetchBundleText(pageUrl) {
  const pageResponse = await fetch(pageUrl);
  const html = await pageResponse.text();
  const scriptSources = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
  const sources = [html, ...(await Promise.all(scriptSources.map(async (source) => fetch(new URL(source, pageUrl)).then((response) => response.text()))))];
  return sources.join('\n');
}

async function verify() {
  const response = await fetch(url, { redirect: 'follow' });
  if (response.status !== 200) throw new Error(`Production URL returned HTTP ${response.status}`);
  if (forbidden.test(await fetchBundleText(url))) throw new Error('Protected credential text found in the public release.');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    for (const selector of [
      '[data-testid="game-canvas"]',
      '[data-testid="start-button"]',
      '[data-testid="score"]',
      '[data-testid="lives"]',
      '[data-testid="mute-button"]',
      '[data-testid="leaderboard"]',
      '[data-testid="touch-controls"]',
    ]) {
      if (!(await page.locator(selector).count())) throw new Error(`Missing production selector: ${selector}`);
    }

    await page.locator('[data-testid="start-button"]').click();
    await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(123456));
    await page.locator('[data-testid="player-name"]').waitFor();
    const name = `NB${Date.now().toString(36)}`;
    await page.locator('[data-testid="player-name"]').fill(name);
    await page.locator('[data-testid="submit-score"]').click();
    await page.getByText(name, { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText(name, { exact: true }).waitFor();

    console.log(JSON.stringify({
      url,
      production_http_status: response.status,
      leaderboard_round_trip: true,
      tests_passed: true,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
