import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "site");
const output = resolve(root, "dist");
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(source, "index.html"), resolve(output, "index.html"));
await cp(resolve(source, "src"), resolve(output, "src"), { recursive: true });
await writeFile(resolve(output, "config.js"), `window.NEON_BARRAGE_CONFIG = Object.freeze(${JSON.stringify({ supabaseUrl, supabaseAnonKey })});\n`, "utf8");
console.log(`Built ${output} (${supabaseUrl ? "Supabase configured" : "local leaderboard mode"})`);
