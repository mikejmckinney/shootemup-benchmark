// Copies the static app into dist/ (no bundler: the app ships native ES modules).
import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ['index.html', 'styles.css', 'src', 'public/_headers']) {
  const from = path.join(root, entry);
  try {
    await stat(from);
  } catch {
    continue;
  }
  const to = entry.startsWith('public/')
    ? path.join(dist, path.basename(entry))
    : path.join(dist, entry);
  await cp(from, to, { recursive: true });
}

const files = await readdir(dist, { recursive: true });
console.log(`built dist/ with ${files.length} entries`);
