import { mkdir, cp, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist/src", { recursive: true });
await cp("index.html", "dist/index.html");
await cp("styles.css", "dist/styles.css");
await cp("config.js", "dist/config.js");
await cp("src/app.js", "dist/src/app.js");
await cp("src/game-logic.js", "dist/src/game-logic.js");
console.log("Built Neon Barrage to dist/");
