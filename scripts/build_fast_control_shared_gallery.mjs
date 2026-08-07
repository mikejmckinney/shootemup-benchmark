#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const [treatment, outputArg] = process.argv.slice(2);
const sharedUrl = String(process.env.SHARED_SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = String(process.env.SHARED_SUPABASE_PUBLISHABLE_KEY ?? "");
const supported = new Set([
  "monolith_luna_xhigh_fast_opencode",
  "monolith_luna_max_fast_opencode",
  "monolith_luna_xhigh_opencode_control",
]);

if (!supported.has(treatment)) throw new Error(`unsupported treatment: ${treatment}`);
if (!outputArg) throw new Error("usage: build_fast_control_shared_gallery.mjs <treatment> <new-output-directory>");
if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(sharedUrl)) throw new Error("SHARED_SUPABASE_URL is invalid");
if (publishableKey.length < 20) throw new Error("SHARED_SUPABASE_PUBLISHABLE_KEY is missing or invalid");

const sourceDir = path.join(root, "submissions", treatment);
const outputDir = path.resolve(outputArg);
await fs.mkdir(outputDir, { recursive: false });
await fs.cp(sourceDir, outputDir, {
  recursive: true,
  filter: source => !["node_modules", "dist", ".wrangler"].includes(path.basename(source)),
});

async function replaceExactly(file, replacements) {
  let contents = await fs.readFile(file, "utf8");
  for (const [before, after] of replacements) {
    const occurrences = contents.split(before).length - 1;
    if (occurrences !== 1) throw new Error(`expected one occurrence in ${file}: ${JSON.stringify(before)}, found ${occurrences}`);
    contents = contents.replace(before, after);
  }
  await fs.writeFile(file, contents);
}

if (treatment === "monolith_luna_xhigh_fast_opencode") {
  await fs.writeFile(
    path.join(outputDir, "config.js"),
    `window.__SUPABASE_CONFIG__ = {\n  url: ${JSON.stringify(sharedUrl)},\n  anonKey: ${JSON.stringify(publishableKey)}\n};\n`,
  );
  await replaceExactly(path.join(outputDir, "src/app.js"), [
    [
      "?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=10",
      `?select=id,name:player_name,score,created_at&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    [
      "body: JSON.stringify({ name, score })",
      `body: JSON.stringify({ candidate_id: "${treatment}", player_name: name, score })`,
    ],
  ]);
} else if (treatment === "monolith_luna_max_fast_opencode") {
  await fs.writeFile(
    path.join(outputDir, "config.js"),
    `window.NEON_BARRAGE_CONFIG = {\n  supabaseUrl: ${JSON.stringify(sharedUrl)},\n  supabaseAnonKey: ${JSON.stringify(publishableKey)}\n};\n`,
  );
  await replaceExactly(path.join(outputDir, "game.js"), [
    [
      "?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=10",
      `?select=id,name:player_name,score,created_at&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    [
      "body: JSON.stringify({ name: nameResult.value, score: state.score })",
      `body: JSON.stringify({ candidate_id: "${treatment}", player_name: nameResult.value, score: state.score })`,
    ],
  ]);
} else {
  await fs.writeFile(
    path.join(outputDir, "config.js"),
    `window.NEON_BARRAGE_CONFIG = {\n  url: ${JSON.stringify(sharedUrl)},\n  anonKey: ${JSON.stringify(publishableKey)}\n};\n`,
  );
  await replaceExactly(path.join(outputDir, "game.js"), [
    [
      "?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=10",
      `?select=id,name:player_name,score,created_at&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    [
      "body: JSON.stringify({ name, score: Math.max(0, Math.min(999999999, Math.floor(state.score))) })",
      `body: JSON.stringify({ candidate_id: "${treatment}", player_name: name, score: Math.max(0, Math.min(999999999, Math.floor(state.score))) })`,
    ],
  ]);
}

console.log(JSON.stringify({ treatment, sourceDir, outputDir }, null, 2));
