import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const [rootArg, framesArg, ...requestedTreatments] = process.argv.slice(2);
if (!rootArg || !framesArg) {
  throw new Error("usage: node capture-gallery.mjs <repo-root> <frames-dir>");
}

const root = path.resolve(rootArg);
const framesRoot = path.resolve(framesArg);
const allTreatments = ["monolith", "native_dynamic", "native_isolated", "a2a", "monolith_warm", "a2a_async", "a2a_async_streaming_opencode", "monolith_sol_medium", "monolith_opencode", "monolith_sol_medium_opencode", "monolith_sol_medium_opencode_api", "monolith_sol_low_opencode", "monolith_sol_high_opencode", "monolith_luna_xhigh_opencode", "monolith_luna_high_opencode", "monolith_luna_max_codex_minimal", "monolith_luna_max_opencode_retest", "monolith_luna_max_opencode_speckit", "dynamic_luna_max_opencode_superpowers", "monolith_luna_max_opencode_ai_repo_template", "monolith_luna_xhigh_fast_opencode", "monolith_luna_max_fast_opencode", "monolith_sol_low_fast_opencode", "monolith_sol_medium_fast_opencode", "monolith_grok_4_5_medium_cursor", "monolith_grok_4_5_high_cursor", "monolith_grok_4_5_medium_fast_cursor", "monolith_grok_4_5_high_fast_cursor", "monolith_auto_cursor", "monolith_luna_xhigh_opencode_control"];
const treatments = requestedTreatments.length
  ? requestedTreatments
  : allTreatments.filter(treatment => existsSync(path.join(root, "candidates", treatment, "benchmark-result.json")));
for (const treatment of treatments) {
  if (!allTreatments.includes(treatment)) throw new Error(`unknown treatment: ${treatment}`);
}
const browser = await chromium.launch({ headless: true });

try {
  for (const treatment of treatments) {
    const result = JSON.parse(await fs.readFile(path.join(root, "candidates", treatment, "benchmark-result.json"), "utf8"));
    const retrofitPath = path.join(root, "results", "evidence", treatment, "shared-gallery-retrofit.json");
    const galleryUrl = existsSync(retrofitPath)
      ? JSON.parse(await fs.readFile(retrofitPath, "utf8")).gallery_url
      : result.cloudflare_url;
    const outputDir = path.join(framesRoot, treatment);
    await fs.mkdir(outputDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference"
    });
    const page = await context.newPage();
    await page.goto(galleryUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator('[data-testid="game-canvas"]').waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(1200);

    let frame = 0;
    const capture = async () => {
      frame += 1;
      await page.screenshot({
        path: path.join(outputDir, `frame-${String(frame).padStart(3, "0")}.png`),
        fullPage: true
      });
    };

    await capture();
    await capture();
    await page.locator('[data-testid="start-button"]').click({ timeout: 10_000 });
    await page.waitForTimeout(250);
    await page.keyboard.down("Space");
    await page.keyboard.down("ArrowRight");

    for (let index = 0; index < 34; index += 1) {
      if (index === 10) {
        await page.keyboard.up("ArrowRight");
        await page.keyboard.down("ArrowLeft");
      }
      if (index === 22) {
        await page.keyboard.up("ArrowLeft");
        await page.keyboard.down("ArrowRight");
      }
      await page.waitForTimeout(165);
      await capture();
    }

    await page.keyboard.up("ArrowLeft").catch(() => {});
    await page.keyboard.up("ArrowRight").catch(() => {});
    await page.keyboard.up("Space").catch(() => {});
    await context.close();
    console.log(`${treatment}: ${frame} frames from ${galleryUrl}`);
  }
} finally {
  await browser.close();
}
