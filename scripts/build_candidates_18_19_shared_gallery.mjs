#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const [treatment, outputArg] = process.argv.slice(2);
const sharedUrl = String(process.env.SHARED_SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = String(process.env.SHARED_SUPABASE_PUBLISHABLE_KEY ?? "");
const supported = new Set(["a2a_async_streaming_opencode", "monolith_sol_high_opencode"]);

if (!supported.has(treatment)) throw new Error(`unsupported treatment: ${treatment}`);
if (!outputArg) throw new Error("usage: build_candidates_18_19_shared_gallery.mjs <treatment> <new-output-directory>");
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

if (treatment === "a2a_async_streaming_opencode") {
  await replaceExactly(path.join(outputDir, "src/main.js"), [
    [
      "?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10",
      `?select=player_name,score,created_at&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    [
      "body: JSON.stringify({ player_name: entry.name, score: entry.score }),",
      `body: JSON.stringify({ candidate_id: '${treatment}', player_name: entry.name, score: entry.score }),`,
    ],
  ]);
  await fs.writeFile(path.join(outputDir, ".env.production"), `VITE_SUPABASE_URL=${sharedUrl}\nVITE_SUPABASE_ANON_KEY=${publishableKey}\n`);
} else {
  await fs.writeFile(
    path.join(outputDir, "src/config.ts"),
    `export const SUPABASE_URL = ${JSON.stringify(sharedUrl)};\nexport const SUPABASE_PUBLIC_KEY = ${JSON.stringify(publishableKey)};\n`,
  );
  await replaceExactly(path.join(outputDir, "src/main.ts"), [
    [
      "/rest/v1/scores?select=name,score&order=score.desc,created_at.asc&limit=10",
      `/rest/v1/leaderboard?select=name:player_name,score&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    ["/rest/v1/scores`, {", "/rest/v1/leaderboard`, {"],
    [
      "body: JSON.stringify({ name, score }),",
      `body: JSON.stringify({ candidate_id: '${treatment}', player_name: name, score }),`,
    ],
  ]);
}

console.log(JSON.stringify({ treatment, sourceDir, outputDir }, null, 2));
