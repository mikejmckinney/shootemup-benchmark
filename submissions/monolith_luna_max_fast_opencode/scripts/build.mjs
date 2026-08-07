import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "dist");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const file of ["index.html", "styles.css", "game.js", "game-logic.js", "config.js"]) {
  await cp(join(root, file), join(destination, file));
}
console.log(`Built Neon Barrage to ${destination}`);
