#!/usr/bin/env node

/**
 * Dependency-free, read-only release checks for Neon Barrage.
 *
 * Default mode validates only the release scaffolding, which is useful while
 * the frontend is still owned by another role. --require-dist turns on the
 * full built-artifact checks. --url performs a read-only production smoke
 * check and never writes to Cloudflare or Supabase.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "wrangler.toml");
const DIST_PATH = path.join(ROOT, "dist");
const EXPECTED_PROJECT_PREFIX = "shootemup-bench-native-dynamic-";

const requiredMarkers = [
  "game-canvas",
  "start-button",
  "score",
  "lives",
  "mute-button",
  "leaderboard",
  "player-name",
  "submit-score",
  "touch-controls",
  "__NEON_BARRAGE__",
  "getState",
  "endGameForTest",
];

const forbiddenPatterns = [
  /SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY|ACCESS_TOKEN)/i,
  /CLOUDFLARE_(?:API_KEY|API_TOKEN)/i,
  /-----BEGIN [^-]*PRIVATE KEY-----/i,
  /(?:postgres|postgresql):\/\/[^\s/@]+:[^\s/@]+@/i,
];

const args = process.argv.slice(2);
const requireDist = args.includes("--require-dist");
const urlIndex = args.indexOf("--url");
const smokeUrl = urlIndex === -1 ? null : args[urlIndex + 1];

if (urlIndex !== -1 && (!smokeUrl || smokeUrl.startsWith("--"))) {
  console.error("--url requires an absolute http(s) URL");
  process.exit(2);
}

const failures = [];

function pass(message) {
  console.log(`PASS  ${message}`);
}

function skip(message) {
  console.log(`SKIP  ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

function configValue(config, key) {
  const match = config.match(new RegExp(`^\\s*${key}\\s*=\\s*[\"']([^\"']+)[\"']`, "m"));
  return match?.[1] ?? null;
}

async function checkConfig() {
  let config;
  try {
    config = await readText(CONFIG_PATH);
  } catch (error) {
    fail(`cannot read wrangler.toml: ${error.message}`);
    return;
  }

  const projectName = configValue(config, "name");
  const outputDir = configValue(config, "pages_build_output_dir");
  const compatibilityDate = configValue(config, "compatibility_date");

  if (!projectName) {
    fail("wrangler.toml has no Pages project name");
  } else if (!projectName.startsWith(EXPECTED_PROJECT_PREFIX)) {
    fail(`Pages project name must start with ${EXPECTED_PROJECT_PREFIX}`);
  } else {
    pass(`Pages project name uses ${projectName}`);
  }

  if (outputDir !== "./dist") {
    fail(`pages_build_output_dir must be ./dist (found ${outputDir ?? "missing"})`);
  } else {
    pass("Pages build output is ./dist");
  }

  if (!compatibilityDate || !/^\d{4}-\d{2}-\d{2}$/.test(compatibilityDate)) {
    fail("wrangler.toml must set compatibility_date as YYYY-MM-DD");
  } else {
    pass(`compatibility_date is ${compatibilityDate}`);
  }

  if (/^\s*main\s*=/m.test(config)) {
    fail("Pages-only config must not declare a Worker main entry point");
  } else {
    pass("Pages config has no Worker main entry point");
  }

  if (forbiddenPatterns.some((pattern) => pattern.test(config))) {
    fail("wrangler.toml contains a credential-like value");
  } else {
    pass("wrangler.toml contains no credential-like value");
  }
}

async function walkTextFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkTextFiles(entryPath)));
    } else if (entry.isFile()) {
      try {
        const contents = await readFile(entryPath);
        if (!contents.includes(0)) {
          files.push({ path: entryPath, text: contents.toString("utf8") });
        }
      } catch {
        // An unreadable/binary asset is not a text surface for these checks.
      }
    }
  }

  return files;
}

function checkMarkers(label, text) {
  for (const marker of requiredMarkers) {
    if (!text.includes(marker)) {
      fail(`${label} is missing required marker: ${marker}`);
    }
  }
}

function checkNoCredentialPatterns(label, text) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(text)) {
      fail(`${label} contains a credential-like pattern: ${pattern}`);
    }
  }
}

async function checkDist() {
  let distStats;
  try {
    distStats = await stat(DIST_PATH);
  } catch {
    if (requireDist) {
      fail("dist/ does not exist; run the frontend build first");
    } else {
      skip("dist/ is absent; use --require-dist after the frontend build");
    }
    return;
  }

  if (!distStats.isDirectory()) {
    fail("dist exists but is not a directory");
    return;
  }

  const indexPath = path.join(DIST_PATH, "index.html");
  try {
    await stat(indexPath);
  } catch {
    fail("dist/index.html is missing");
  }

  const files = await walkTextFiles(DIST_PATH);
  if (files.length === 0) {
    fail("dist/ contains no readable text assets");
    return;
  }

  const combined = files.map(({ text }) => text).join("\n");
  checkMarkers("built artifact", combined);
  checkNoCredentialPatterns("built artifact", combined);

  if (!failures.some((message) => message.startsWith("built artifact is missing"))) {
    pass("built artifact contains the required selectors and test adapter markers");
  }
  if (!failures.some((message) => message.startsWith("built artifact contains"))) {
    pass(`scanned ${files.length} built text asset(s) for credential-like patterns`);
  }
}

function absoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(target, timeoutMs = 15_000) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/javascript",
          "user-agent": "Mozilla/5.0",
        },
      });
      if (![502, 503, 504, 522, 523, 524].includes(response.status) || attempt === 2) return response;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("production request did not stabilize");
}

function sameOriginAssetUrls(html, pageUrl) {
  const references = [];
  const patterns = [
    /<script[^>]+src=["']([^"']+)["']/gi,
    /<link[^>]+(?:rel=["'][^"']*modulepreload[^"']*["'][^>]+)?href=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      try {
        const asset = new URL(match[1], pageUrl);
        if (asset.origin === pageUrl.origin) {
          asset.hash = "";
          references.push(asset.href);
        }
      } catch {
        // Ignore malformed or external references; the HTML status still gets checked.
      }
    }
  }

  return [...new Set(references)].slice(0, 32);
}

async function checkProductionUrl() {
  const pageUrl = absoluteHttpUrl(smokeUrl);
  if (!pageUrl) {
    fail("--url must be an absolute http(s) URL");
    return;
  }

  let response;
  try {
    response = await fetchWithTimeout(pageUrl);
  } catch (error) {
    fail(`production request failed: ${error.message}`);
    return;
  }

  if (response.status !== 200) {
    fail(`production URL returned HTTP ${response.status}, expected 200`);
  } else {
    pass("production URL returned HTTP 200");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    fail(`production URL content type is not HTML: ${contentType || "missing"}`);
  } else {
    pass("production URL returned HTML");
  }

  const html = await response.text();
  const bodies = [html];
  for (const assetUrl of sameOriginAssetUrls(html, pageUrl)) {
    try {
      const assetResponse = await fetchWithTimeout(assetUrl);
      if (assetResponse.status !== 200) {
        fail(`same-origin asset returned HTTP ${assetResponse.status}: ${assetUrl}`);
        continue;
      }
      bodies.push(await assetResponse.text());
    } catch (error) {
      fail(`same-origin asset request failed for ${assetUrl}: ${error.message}`);
    }
  }

  const combined = bodies.join("\n");
  checkMarkers("production response/assets", combined);
  checkNoCredentialPatterns("production response/assets", combined);
  if (!failures.some((message) => message.startsWith("production response/assets is missing"))) {
    pass("production response/assets contain the required selectors and test adapter markers");
  }
  if (!failures.some((message) => message.startsWith("production response/assets contains"))) {
    pass("production response/assets contain no credential-like patterns");
  }
}

await checkConfig();
if (requireDist) {
  await checkDist();
} else if (!smokeUrl) {
  await checkDist();
}
if (smokeUrl) {
  await checkProductionUrl();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} release check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nRelease checks passed for the requested scope.");
}
