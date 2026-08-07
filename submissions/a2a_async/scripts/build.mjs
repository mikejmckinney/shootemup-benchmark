import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(resolve(dist, "src"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js", "supabase-client.js", "supabase-config.js"]) {
  await cp(resolve(root, file), resolve(dist, file));
}
await cp(resolve(root, "src/game-logic.mjs"), resolve(dist, "src/game-logic.mjs"));
await cp(resolve(root, "src/game-engine.js"), resolve(dist, "src/game-engine.js"));
console.log(`Built ${dist}`);
