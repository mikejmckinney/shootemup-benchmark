export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const validName = name => /^[A-Za-z0-9 _-]{1,16}$/.test(name) && name.trim() === name;
export const difficulty = score => ({ spawnMs: Math.max(260, 900 - score * 1.4), speed: Math.min(250, 72 + score * .16) });
