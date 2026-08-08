import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });

const html = await readFile(resolve(dist, "index.html"), "utf8");
const requiredSelectors = [
  'data-testid="game-canvas"',
  'data-testid="start-button"',
  'data-testid="score"',
  'data-testid="lives"',
  'data-testid="mute-button"',
  'data-testid="leaderboard"',
  'data-testid="player-name"',
  'data-testid="submit-score"',
  'data-testid="touch-controls"'
];

for (const selector of requiredSelectors) {
  if (!html.includes(selector)) {
    throw new Error(`Missing required selector: ${selector}`);
  }
}

console.log(`Static build ready: ${dist}`);
