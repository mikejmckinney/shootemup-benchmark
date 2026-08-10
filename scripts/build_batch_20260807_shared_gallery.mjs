#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const [treatment, outputArg] = process.argv.slice(2);
const sharedUrl = String(process.env.SHARED_SUPABASE_URL ?? "").replace(/\/$/, "");
const publishableKey = String(process.env.SHARED_SUPABASE_PUBLISHABLE_KEY ?? "");
const supported = new Set([
  "monolith_sol_low_fast_opencode",
  "monolith_sol_medium_fast_opencode",
  "monolith_grok_4_5_medium_cursor",
  "monolith_grok_4_5_high_cursor",
  "monolith_grok_4_5_medium_fast_cursor",
  "monolith_grok_4_5_high_fast_cursor",
  "monolith_auto_cursor",
  "monolith_sol_medium_opencode_api",
  "monolith_opus_5_medium_claude_code",
  "monolith_sonnet_5_medium_claude_code",
  "monolith_opus_5_medium_opencode",
  "monolith_sonnet_5_medium_opencode",
  "monolith_opus_5_medium_opencode_oauth",
]);

if (!supported.has(treatment)) throw new Error(`unsupported treatment: ${treatment}`);
if (!outputArg) throw new Error("usage: build_batch_20260807_shared_gallery.mjs <treatment> <new-output-directory>");
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
    if (occurrences !== 1) {
      throw new Error(`expected one occurrence in ${file}: ${JSON.stringify(before)}, found ${occurrences}`);
    }
    contents = contents.replace(before, after);
  }
  await fs.writeFile(file, contents);
}

if (treatment === "monolith_sol_low_fast_opencode") {
  const result = JSON.parse(await fs.readFile(path.join(sourceDir, "benchmark-result.json"), "utf8"));
  await replaceExactly(path.join(outputDir, "public/game.js"), [
    [`const SUPABASE_URL='${result.supabase_url}';`, `const SUPABASE_URL='${sharedUrl}';`],
    [`const SUPABASE_KEY='${result.supabase_public_key}';`, `const SUPABASE_KEY='${publishableKey}';`],
    [
      "/rest/v1/scores?select=player_name,score&order=score.desc,created_at.asc&limit=10",
      `/rest/v1/leaderboard?select=player_name,score&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    ["/rest/v1/scores`,{method:'POST'", "/rest/v1/leaderboard`,{method:'POST'"],
    [
      "body:JSON.stringify({player_name,score:state.score})",
      `body:JSON.stringify({candidate_id:'${treatment}',player_name,score:state.score})`,
    ],
  ]);
} else if (treatment === "monolith_sol_medium_fast_opencode") {
  const result = JSON.parse(await fs.readFile(path.join(sourceDir, "benchmark-result.json"), "utf8"));
  await replaceExactly(path.join(outputDir, "app.js"), [
    [`const SUPABASE_URL = '${result.supabase_url}';`, `const SUPABASE_URL = '${sharedUrl}';`],
    [`const SUPABASE_KEY = '${result.supabase_public_key}';`, `const SUPABASE_KEY = '${publishableKey}';`],
    [
      "?select=player_name,score&order=score.desc,created_at.asc&limit=10",
      `?select=player_name,score&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    [
      "body:JSON.stringify({player_name:name,score})",
      `body:JSON.stringify({candidate_id:'${treatment}',player_name:name,score})`,
    ],
  ]);
} else if (treatment === "monolith_sol_medium_opencode_api") {
  await fs.writeFile(
    path.join(outputDir, ".env.production"),
    `VITE_SUPABASE_URL=${sharedUrl}\nVITE_SUPABASE_ANON_KEY=${publishableKey}\n`,
  );
  await replaceExactly(path.join(outputDir, "src/main.ts"), [
    [
      "?select=name,score&order=score.desc,created_at.asc&limit=10",
      `?select=name:player_name,score&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=10`,
    ],
    [
      "body:JSON.stringify({name,score})",
      `body:JSON.stringify({candidate_id:'${treatment}',player_name:name,score})`,
    ],
  ]);
} else if (treatment === "monolith_opus_5_medium_claude_code") {
  const result = JSON.parse(await fs.readFile(path.join(sourceDir, "benchmark-result.json"), "utf8"));
  await replaceExactly(path.join(outputDir, "src/config.js"), [
    [`export const SUPABASE_URL = '${result.supabase_url}';`, `export const SUPABASE_URL = '${sharedUrl}';`],
    [`export const SUPABASE_ANON_KEY = '${result.supabase_public_key}';`, `export const SUPABASE_ANON_KEY = '${publishableKey}';`],
  ]);
  await replaceExactly(path.join(outputDir, "public/_headers"), [
    [result.supabase_url, sharedUrl],
  ]);
  await replaceExactly(path.join(outputDir, "src/leaderboard.js"), [
    [
      "?select=name,score,created_at&order=score.desc,created_at.asc&limit=${count}",
      `?select=name:player_name,score,created_at&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=\${count}`,
    ],
    [
      "body: JSON.stringify({ name: validName.value, score: validScore.value }),",
      `body: JSON.stringify({ candidate_id: '${treatment}', player_name: validName.value, score: validScore.value }),`,
    ],
  ]);
} else if (treatment === "monolith_sonnet_5_medium_claude_code") {
  await fs.writeFile(
    path.join(outputDir, ".env.production"),
    `VITE_SUPABASE_URL=${sharedUrl}\nVITE_SUPABASE_ANON_KEY=${publishableKey}\n`,
  );
  await replaceExactly(path.join(outputDir, "src/leaderboard.ts"), [
    [".order(\"score\", { ascending: false })", `.eq("candidate_id", "${treatment}")\n      .order("score", { ascending: false })`],
    [
      ".insert({ player_name: name.trim(), score });",
      `.insert({ candidate_id: "${treatment}", player_name: name.trim(), score });`,
    ],
  ]);
} else if (treatment === "monolith_opus_5_medium_opencode") {
  await fs.writeFile(
    path.join(outputDir, ".env.production"),
    `VITE_SUPABASE_URL=${sharedUrl}\nVITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}\n`,
  );
  await replaceExactly(path.join(outputDir, "src/leaderboard.ts"), [
    [
      "/rest/v1/scores?select=name,score,created_at&order=score.desc,created_at.asc&limit=${limit}",
      `/rest/v1/leaderboard?select=name:player_name,score,created_at&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=\${limit}`,
    ],
    ["fetch(`${URL_BASE}/rest/v1/scores`, {", "fetch(`${URL_BASE}/rest/v1/leaderboard`, {"],
    [
      "body: JSON.stringify({ name: v.name, score }),",
      `body: JSON.stringify({ candidate_id: '${treatment}', player_name: v.name, score }),`,
    ],
  ]);
} else if (treatment === "monolith_opus_5_medium_opencode_oauth") {
  await fs.writeFile(
    path.join(outputDir, ".env.production"),
    `VITE_SUPABASE_URL=${sharedUrl}\nVITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}\n`,
  );
  await replaceExactly(path.join(outputDir, "src/leaderboard.ts"), [
    [
      "leaderboard?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=${limit}",
      `leaderboard?select=id,name:player_name,score,created_at&candidate_id=eq.${treatment}&order=score.desc,created_at.asc&limit=\${limit}`,
    ],
    [
      "body: JSON.stringify({ name: nameCheck.name, score }),",
      `body: JSON.stringify({ candidate_id: '${treatment}', player_name: nameCheck.name, score }),`,
    ],
  ]);
} else if (treatment === "monolith_sonnet_5_medium_opencode") {
  await fs.writeFile(
    path.join(outputDir, ".env.production"),
    `VITE_SUPABASE_URL=${sharedUrl}\nVITE_SUPABASE_ANON_KEY=${publishableKey}\n`,
  );
  await replaceExactly(path.join(outputDir, "src/supabaseClient.ts"), [
    [
      ".order('score', { ascending: false })",
      `.eq('candidate_id', '${treatment}')\n    .order('score', { ascending: false })`,
    ],
    [
      ".insert({\n    player_name: playerName,",
      `.insert({\n    candidate_id: '${treatment}',\n    player_name: playerName,`,
    ],
  ]);
} else {
  await fs.writeFile(
    path.join(outputDir, ".env.production"),
    `VITE_SUPABASE_URL=${sharedUrl}\nVITE_SUPABASE_ANON_KEY=${publishableKey}\n`,
  );
  const leaderboardFile = path.join(outputDir, "src/leaderboard.ts");
  let contents = await fs.readFile(leaderboardFile, "utf8");
  const limitPattern = /\n(\s*)\.limit\(limit\);/;
  if (!limitPattern.test(contents)) throw new Error(`fetch limit chain not found in ${leaderboardFile}`);
  contents = contents.replace(limitPattern, `\n$1.eq('candidate_id', '${treatment}')\n$1.limit(limit);`);
  const insertPattern = /\.insert\(\{(\s*)/;
  if (!insertPattern.test(contents)) throw new Error(`insert object not found in ${leaderboardFile}`);
  contents = contents.replace(insertPattern, `.insert({$1candidate_id: '${treatment}',$1`);
  await fs.writeFile(leaderboardFile, contents);
}

console.log(JSON.stringify({ treatment, sourceDir, outputDir }, null, 2));
