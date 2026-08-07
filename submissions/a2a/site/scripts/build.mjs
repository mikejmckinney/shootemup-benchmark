import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const output = resolve(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, 'index.html'), resolve(output, 'index.html'));
await cp(resolve(root, 'config.js'), resolve(output, 'config.js'));
await cp(resolve(root, 'src'), resolve(output, 'src'), { recursive: true });
console.log(`Built Neon Barrage to ${output}`);
