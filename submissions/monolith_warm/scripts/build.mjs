import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

const configPath = resolve(output, "config.js");
const config = await readFile(configPath, "utf8");
const productionConfig = config
  .replaceAll("__SUPABASE_URL__", process.env.SUPABASE_URL ?? "")
  .replaceAll("__SUPABASE_PUBLIC_KEY__", process.env.SUPABASE_PUBLIC_KEY ?? "");
await writeFile(configPath, productionConfig);

console.log(`Built Neon Barrage to ${output}`);
