import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const output = resolve(root, "dist");

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });

for (const file of ["index.html", "styles.css", "game.js", "game-logic.js"]) {
  await cp(resolve(source, file), resolve(output, file));
}

const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";
const config = `export const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};\n`;
await writeFile(resolve(output, "config.js"), config, "utf8");

console.log(`Built Neon Barrage to ${output}`);
console.log(supabaseUrl ? "Supabase leaderboard configuration embedded." : "No Supabase configuration supplied; leaderboard will show offline state.");
