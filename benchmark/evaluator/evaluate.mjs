import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const [candidateDirArg, evidenceDirArg] = process.argv.slice(2);
if (!candidateDirArg || !evidenceDirArg) {
  throw new Error("usage: node evaluate.mjs <candidate-dir> <evidence-dir>");
}

const candidateDir = path.resolve(candidateDirArg);
const evidenceDir = path.resolve(evidenceDirArg);
await fs.mkdir(evidenceDir, { recursive: true });

const report = {
  evaluated_at: new Date().toISOString(),
  candidate_dir: candidateDir,
  result_artifact_valid: false,
  automated_points: 0,
  automated_points_available: 54,
  checks: {},
  console_errors: [],
  page_errors: [],
  supabase_requests: [],
  notes: []
};

function check(name, passed, points, evidence = null) {
  report.checks[name] = { passed: Boolean(passed), points_awarded: passed ? points : 0, points_available: points, evidence };
  if (passed) report.automated_points += points;
}

function validResult(value) {
  return value && value.status === "complete" &&
    typeof value.treatment === "string" &&
    /^https:\/\//.test(value.cloudflare_url || "") &&
    /^https:\/\/[a-z]{20}\.supabase\.co\/?$/.test(value.supabase_url || "") &&
    /^[a-z]{20}$/.test(value.supabase_project_ref || "") &&
    typeof value.supabase_public_key === "string" && value.supabase_public_key.length > 20 &&
    value.verification?.production_http_status === 200 &&
    value.verification?.leaderboard_round_trip === true &&
    value.verification?.tests_passed === true;
}

let result;
try {
  result = JSON.parse(await fs.readFile(path.join(candidateDir, "benchmark-result.json"), "utf8"));
  report.result_artifact_valid = validResult(result);
} catch (error) {
  report.notes.push(`result artifact: ${error.message}`);
}
check("valid_result_artifact", report.result_artifact_valid, 3);

let browser;
try {
  if (!report.result_artifact_valid) throw new Error("valid benchmark-result.json is required for live evaluation");
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("console", message => {
    if (message.type() === "error") report.console_errors.push(message.text());
  });
  page.on("pageerror", error => report.page_errors.push(error.message));
  page.on("response", response => {
    const url = response.url();
    if (url.includes(".supabase.co/") && /\/rest\/v1\/|\/functions\/v1\//.test(url)) {
      report.supabase_requests.push({ method: response.request().method(), status: response.status(), url: url.replace(/\?.*$/, "") });
    }
  });

  const response = await page.goto(result.cloudflare_url, { waitUntil: "networkidle", timeout: 45_000 });
  const canvas = page.locator('[data-testid="game-canvas"]');
  const canvasVisible = await canvas.isVisible().catch(() => false);
  check("live_cloudflare_app", response?.status() === 200 && canvasVisible, 5, { http_status: response?.status(), canvas_visible: canvasVisible });

  const requiredSelectors = ["start-button", "score", "lives", "mute-button", "leaderboard", "player-name", "submit-score", "touch-controls"];
  const selectorPresence = {};
  for (const id of requiredSelectors) selectorPresence[id] = await page.locator(`[data-testid="${id}"]`).count();
  const adapterPresent = await page.evaluate(() => Boolean(window.__NEON_BARRAGE__?.getState && window.__NEON_BARRAGE__?.endGameForTest));
  check("required_test_surface", Object.values(selectorPresence).every(Boolean) && adapterPresent, 2, { selectorPresence, adapterPresent });

  await page.screenshot({ path: path.join(evidenceDir, "desktop-before.png"), fullPage: true });
  await page.locator('[data-testid="start-button"]').click({ timeout: 10_000 });
  await page.waitForTimeout(300);
  const initial = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(350);
  await page.keyboard.up("ArrowRight");
  const moved = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  await page.keyboard.down("Space");
  await page.waitForTimeout(80);
  const fired = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  await page.keyboard.up("Space");
  check("game_starts", ["playing", "running"].includes(String(initial.phase).toLowerCase()), 2, initial);
  check("keyboard_movement", Math.abs(Number(moved.playerX) - Number(initial.playerX)) > 0.5 || Math.abs(Number(moved.playerY) - Number(initial.playerY)) > 0.5, 3, { initial, moved });
  check("keyboard_fire", Number(fired.projectileCount) > Number(moved.projectileCount), 3, { moved, fired });

  await page.waitForTimeout(3200);
  const populated = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  check("enemies_spawn", Number(populated.enemyCount) > 0, 3, populated);
  check("hud_state", Number.isFinite(Number(populated.score)) && Number.isFinite(Number(populated.lives)) && Number(populated.lives) >= 0, 2, populated);

  const scoreToSubmit = 7317;
  await page.evaluate(score => window.__NEON_BARRAGE__.endGameForTest(score), scoreToSubmit);
  await page.waitForTimeout(250);
  const gameOver = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  check("game_over_adapter_uses_real_state", /over|ended/.test(String(gameOver.phase).toLowerCase()) && Number(gameOver.score) === scoreToSubmit, 3, gameOver);

  const testName = `BMX${Date.now().toString().slice(-10)}`;
  const nameInput = page.locator('[data-testid="player-name"]');
  const submitButton = page.locator('[data-testid="submit-score"]');
  try {
    await nameInput.fill(testName, { timeout: 5_000 });
    await submitButton.click();
    await page.locator('[data-testid="leaderboard"]').getByText(testName, { exact: false }).waitFor({ timeout: 20_000 });
    const postSucceeded = report.supabase_requests.some(item => item.method === "POST" && item.status >= 200 && item.status < 300);
    check("leaderboard_ui_submission", postSucceeded, 6, { testName, requests: report.supabase_requests });
    await page.reload({ waitUntil: "networkidle", timeout: 45_000 });
    const persisted = await page.locator('[data-testid="leaderboard"]').getByText(testName, { exact: false }).isVisible().catch(() => false);
    const getSucceeded = report.supabase_requests.some(item => item.method === "GET" && item.status >= 200 && item.status < 300);
    check("leaderboard_reload_persistence", persisted && getSucceeded, 6, { testName, persisted, requests: report.supabase_requests });
    const leaderboardText = await page.locator('[data-testid="leaderboard"]').innerText().catch(() => "");
    const scoreVisible = leaderboardText.includes(String(scoreToSubmit)) ||
      leaderboardText.includes(scoreToSubmit.toLocaleString("en-US"));
    check("leaderboard_score_visible", scoreVisible, 3, { leaderboardText: leaderboardText.slice(0, 1000) });
  } catch (error) {
    report.notes.push(`leaderboard flow failed: ${error.message}`);
    check("leaderboard_ui_submission", false, 6, { testName, error: error.message });
    check("leaderboard_reload_persistence", false, 6, { testName, error: error.message });
    check("leaderboard_score_visible", false, 3, { error: error.message });
  }

  const mute = page.locator('[data-testid="mute-button"]');
  const muteBefore = `${await mute.textContent().catch(() => "")} ${await mute.getAttribute("aria-label").catch(() => "")}`;
  await mute.click().catch(() => {});
  const muteAfter = `${await mute.textContent().catch(() => "")} ${await mute.getAttribute("aria-label").catch(() => "")}`;
  check("mute_control", muteBefore !== muteAfter || /muted|unmute/i.test(muteAfter), 3, { muteBefore, muteAfter });

  const restartVisible = await page.locator('[data-testid="start-button"]').isVisible().catch(() => false);
  if (restartVisible) {
    await page.locator('[data-testid="start-button"]').click();
    await page.waitForTimeout(200);
  }
  const restarted = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
  check("restart", restartVisible && ["playing", "running"].includes(String(restarted.phase).toLowerCase()) && Number(restarted.score) === 0, 2, restarted);
  const labeled = await page.locator('button[aria-label], input[aria-label], label').count().catch(() => 0);
  check("basic_accessible_labels", labeled >= 2, 1, { labeledElements: labeled });
  await page.screenshot({ path: path.join(evidenceDir, "desktop-after.png"), fullPage: true });

  await context.close();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(result.cloudflare_url, { waitUntil: "networkidle", timeout: 45_000 });
  const touch = mobilePage.locator('[data-testid="touch-controls"]');
  const touchVisible = await touch.isVisible().catch(() => false);
  const box = await mobilePage.locator('[data-testid="game-canvas"]').boundingBox().catch(() => null);
  const fits = Boolean(box && box.x >= -1 && box.x + box.width <= 391);
  check("mobile_touch_and_fit", touchVisible && fits, 5, { touchVisible, canvasBox: box });
  await mobilePage.screenshot({ path: path.join(evidenceDir, "mobile.png"), fullPage: true });
  await mobileContext.close();

  const errorFree = report.console_errors.length === 0 && report.page_errors.length === 0;
  check("browser_error_free", errorFree, 2, { console_errors: report.console_errors, page_errors: report.page_errors });
} catch (error) {
  report.notes.push(`browser evaluation stopped: ${error.stack || error.message}`);
} finally {
  await browser?.close().catch(() => {});
}

await fs.writeFile(path.join(evidenceDir, "automated.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
