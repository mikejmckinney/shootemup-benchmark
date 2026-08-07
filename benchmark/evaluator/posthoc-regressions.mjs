import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, "../.."));
const evidenceRoot = path.resolve(process.env.POSTHOC_EVIDENCE_ROOT || path.join(root, "results", "evidence"));
const candidateRoot = path.resolve(process.env.POSTHOC_CANDIDATE_ROOT || path.join(root, "candidates"));
const allTreatments = [
  "monolith",
  "native_dynamic",
  "native_isolated",
  "a2a",
  "monolith_warm",
  "a2a_async",
  "a2a_async_streaming_opencode",
  "monolith_sol_medium",
  "monolith_opencode",
  "monolith_sol_medium_opencode",
  "monolith_sol_medium_opencode_api",
  "monolith_sol_low_opencode",
  "monolith_sol_high_opencode",
  "monolith_luna_xhigh_opencode",
  "monolith_luna_high_opencode",
  "monolith_luna_max_codex_minimal",
  "monolith_luna_max_opencode_retest",
  "monolith_luna_max_opencode_speckit",
  "dynamic_luna_max_opencode_superpowers",
  "monolith_luna_xhigh_fast_opencode",
  "monolith_luna_max_fast_opencode",
  "monolith_sol_low_fast_opencode",
  "monolith_sol_medium_fast_opencode",
  "monolith_grok_4_5_medium_cursor",
  "monolith_grok_4_5_high_cursor",
  "monolith_grok_4_5_medium_fast_cursor",
  "monolith_grok_4_5_high_fast_cursor",
  "monolith_auto_cursor",
  "monolith_luna_xhigh_opencode_control",
];
const requested = process.argv.slice(3);
const treatments = requested.length
  ? requested
  : allTreatments.filter(treatment => existsSync(path.join(root, "candidates", treatment, "benchmark-result.json")));
const physicalInputProbe = "WASD wasd";
const mockRow = { player_name: "AUDIT", score: 7317, created_at: "2026-08-06T00:00:00Z" };

for (const treatment of treatments) {
  if (!allTreatments.includes(treatment)) throw new Error(`Unknown treatment: ${treatment}`);
}

const browser = await chromium.launch({ headless: true });

async function visibleProgress(page) {
  return page.locator('[id*="threat" i], [id*="wave" i], [id*="level" i], [data-testid*="threat" i], [data-testid*="wave" i], [data-testid*="level" i]').evaluateAll(elements =>
    elements
      .filter(element => element.getClientRects().length > 0)
      .map(element => ({ selector: element.id ? `#${element.id}` : `[data-testid="${element.dataset.testid}"]`, text: element.textContent.trim() }))
  );
}

async function firstVisible(locator) {
  for (let index = 0; index < await locator.count(); index += 1) {
    const item = locator.nth(index);
    if (await item.isVisible().catch(() => false)) return item;
  }
  return null;
}

try {
  for (const treatment of treatments) {
    const resultPath = process.env.POSTHOC_CANDIDATE_ROOT
      ? path.join(candidateRoot, "benchmark-result.json")
      : path.join(candidateRoot, treatment, "benchmark-result.json");
    if (!existsSync(resultPath)) {
      const reason = "Not applicable: candidate produced no valid live result artifact; affected rubric categories already received zero points.";
      const report = {
        treatment,
        evaluated_at: new Date().toISOString(),
        live_url: null,
        methodology: "No browser audit was possible because the candidate did not deploy. No additional deductions are applied to categories already scored zero.",
        checks: Object.fromEntries([
          "physical_name_entry",
          "progression_start_consistency",
          "advertised_keyboard_restart",
          "immediate_click_restart",
        ].map(check => [check, { applicable: false, passed: null, reason }])),
        requests: [],
        console_errors: [],
        page_errors: [],
      };
      await fs.mkdir(path.join(evidenceRoot, treatment), { recursive: true });
      await fs.writeFile(path.join(evidenceRoot, treatment, "posthoc-regressions.json"), `${JSON.stringify(report, null, 2)}\n`);
      console.log(`${treatment}: browser audit not applicable (no live result artifact)`);
      continue;
    }
    const result = JSON.parse(await fs.readFile(resultPath, "utf8"));
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const requests = [];
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.route("**/rest/v1/leaderboard**", async route => {
      const method = route.request().method();
      requests.push(method);
      await route.fulfill({
        status: method === "POST" ? 201 : 200,
        contentType: "application/json",
        body: method === "POST" ? JSON.stringify([mockRow]) : JSON.stringify([mockRow]),
      });
    });

    const report = {
      treatment,
      evaluated_at: new Date().toISOString(),
      live_url: result.cloudflare_url,
      methodology: "Live production build with Supabase REST requests mocked in-browser; no leaderboard rows were written.",
      checks: {},
      requests,
      console_errors: consoleErrors,
      page_errors: pageErrors,
    };

    try {
      const response = await page.goto(result.cloudflare_url, { waitUntil: "networkidle", timeout: 45_000 });
      report.http_status = response?.status() ?? null;
      report.progress_before_start = await visibleProgress(page);
      await page.locator('[data-testid="start-button"]').click({ timeout: 10_000 });
      await page.waitForTimeout(250);
      report.progress_after_start = await visibleProgress(page);
      const beforeProgress = Number(report.progress_before_start[0]?.text.match(/\d+/)?.[0]);
      const afterProgress = Number(report.progress_after_start[0]?.text.match(/\d+/)?.[0]);
      const progressionApplicable = Number.isFinite(beforeProgress) && Number.isFinite(afterProgress);
      report.checks.progression_start_consistency = {
        passed: progressionApplicable ? afterProgress - beforeProgress <= 1 : true,
        applicable: progressionApplicable,
        before: progressionApplicable ? beforeProgress : null,
        after: progressionApplicable ? afterProgress : null,
      };

      await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(7317));
      await page.waitForTimeout(100);
      const nameInput = page.locator('[data-testid="player-name"]');
      await nameInput.fill("");
      await nameInput.focus();
      await page.keyboard.type(physicalInputProbe, { delay: 25 });
      const physicalValue = await nameInput.inputValue();
      report.checks.physical_name_entry = {
        passed: physicalValue === physicalInputProbe,
        expected: physicalInputProbe,
        actual: physicalValue,
      };

      // A broken global key handler can restart the game while typing a space.
      // Restore the same game-over precondition before exercising submission.
      await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(7317));
      await page.waitForTimeout(100);
      await nameInput.fill("AUDIT");
      await page.locator('[data-testid="submit-score"]').click();
      await page.waitForTimeout(750);
      report.state_after_submit = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
      report.active_element_after_submit = await page.evaluate(() => ({
        tag: document.activeElement?.tagName || null,
        id: document.activeElement?.id || null,
        testid: document.activeElement?.dataset?.testid || null,
      }));

      const visibleText = await page.locator("body").innerText();
      const advertisesR = /(?:\[R\]|press\s+R\b|\bR\s+to\s+(?:restart|re-?launch|play))/i.test(visibleText);
      let keyboardRestartPassed = null;
      if (advertisesR) {
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        const keyboardState = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
        keyboardRestartPassed = ["playing", "running"].includes(String(keyboardState.phase).toLowerCase()) && Number(keyboardState.score) === 0;
        report.keyboard_restart_state = keyboardState;
      }
      report.checks.advertised_keyboard_restart = {
        passed: advertisesR ? keyboardRestartPassed : true,
        advertised: advertisesR,
        applicable: advertisesR,
      };

      if (["playing", "running"].includes(String((await page.evaluate(() => window.__NEON_BARRAGE__.getState())).phase).toLowerCase())) {
        await page.evaluate(() => window.__NEON_BARRAGE__.endGameForTest(7317));
        await page.waitForTimeout(100);
      }
      const restartButton = await firstVisible(page.getByRole("button", { name: /restart|re-?launch|fly again|play again|try again|run it back|launch again/i }));
      let clickRestartPassed = false;
      let clickState = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
      if (restartButton) {
        await restartButton.click();
        await page.waitForTimeout(200);
        clickState = await page.evaluate(() => window.__NEON_BARRAGE__.getState());
        clickRestartPassed = ["playing", "running"].includes(String(clickState.phase).toLowerCase()) && Number(clickState.score) === 0;
      }
      report.checks.immediate_click_restart = { passed: clickRestartPassed, button_found: Boolean(restartButton), state: clickState };
    } catch (error) {
      report.fatal_error = error.stack || error.message;
    }

    await fs.mkdir(path.join(evidenceRoot, treatment), { recursive: true });
    await fs.writeFile(path.join(evidenceRoot, treatment, "posthoc-regressions.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${treatment}: name=${report.checks.physical_name_entry?.passed ?? "error"} keyboard-restart=${report.checks.advertised_keyboard_restart?.passed ?? "error"} click-restart=${report.checks.immediate_click_restart?.passed ?? "error"}`);
    await context.close();
  }
} finally {
  await browser.close();
}
