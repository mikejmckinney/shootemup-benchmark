#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const roots = process.argv.slice(2).map(value => path.resolve(value));
if (!roots.length) throw new Error("usage: redact_retained_logs.mjs <file-or-directory> [...]");

let supplied;
try { supplied = JSON.parse(process.env.REDACTION_SECRETS_JSON ?? "[]"); } catch { throw new Error("REDACTION_SECRETS_JSON must be a JSON array"); }
const secrets = [...new Set(supplied.map(String).filter(value => value.length >= 16))].sort((a, b) => b.length - a.length);
if (!secrets.length) throw new Error("no secrets supplied for redaction");

async function filesUnder(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [target];
  const entries = await fs.readdir(target, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => filesUnder(path.join(target, entry.name))));
  return nested.flat();
}

let filesChanged = 0;
let replacements = 0;
for (const root of roots) {
  for (const file of await filesUnder(root)) {
    let contents;
    try { contents = await fs.readFile(file, "utf8"); } catch { continue; }
    let updated = contents;
    for (const secret of secrets) {
      const count = updated.split(secret).length - 1;
      if (!count) continue;
      replacements += count;
      updated = updated.split(secret).join("[REDACTED_PRIVILEGED_CREDENTIAL]");
    }
    if (updated !== contents) {
      await fs.writeFile(file, updated);
      filesChanged += 1;
    }
  }
}

console.log(JSON.stringify({ filesChanged, replacements }, null, 2));
