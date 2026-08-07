#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(root, "submissions/monolith_luna_max_opencode_retest/public");
const outputArg = process.argv[2];
const sharedUrl = String(process.env.SHARED_SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = String(process.env.SHARED_SUPABASE_PUBLISHABLE_KEY ?? "");
const candidateId = "monolith_luna_max_opencode_retest";

if (!outputArg) throw new Error("usage: build_candidate15_shared_gallery.mjs <new-output-directory>");
if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(sharedUrl)) throw new Error("SHARED_SUPABASE_URL is invalid");
if (publishableKey.length < 20) throw new Error("SHARED_SUPABASE_PUBLISHABLE_KEY is missing or invalid");

const outputDir = path.resolve(outputArg);
await fs.mkdir(outputDir, { recursive: false });
await fs.cp(sourceDir, outputDir, { recursive: true, errorOnExist: true });

const appPath = path.join(outputDir, "app.js");
let app = await fs.readFile(appPath, "utf8");

const replacements = [
  [
    "rest/v1/leaderboard_entries?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10",
    `rest/v1/leaderboard?select=player_name,score,created_at&candidate_id=eq.${candidateId}&order=score.desc,created_at.asc&limit=10`
  ],
  [
    "`${config.url}/rest/v1/leaderboard_entries`, { method: \"POST\"",
    "`${config.url}/rest/v1/leaderboard`, { method: \"POST\""
  ],
  [
    "body: JSON.stringify({ player_name: name, score: game.score })",
    `body: JSON.stringify({ candidate_id: "${candidateId}", player_name: name, score: game.score })`
  ]
];

for (const [before, after] of replacements) {
  const occurrences = app.split(before).length - 1;
  if (occurrences !== 1) throw new Error(`expected one occurrence of ${JSON.stringify(before)}, found ${occurrences}`);
  app = app.replace(before, after);
}

await fs.writeFile(appPath, app);
await fs.writeFile(
  path.join(outputDir, "supabase-config.js"),
  `window.__NEON_BARRAGE_CONFIG__ = {\n  url: ${JSON.stringify(sharedUrl)},\n  anonKey: ${JSON.stringify(publishableKey)}\n};\n`
);

console.log(JSON.stringify({ outputDir, candidateId, sourceDir, files: await fs.readdir(outputDir) }, null, 2));
