import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(ROOT,'RELEASE_MANIFEST.json');
const manifest = JSON.parse(await fs.readFile(manifestPath,'utf8'));
const errors = [];
for (const entry of manifest.files ?? []) {
  if (!entry.path || path.isAbsolute(entry.path) || entry.path.split(/[\\/]/).includes('..')) { errors.push(`Unsafe manifest path: ${entry.path}`); continue; }
  const full = path.resolve(ROOT, entry.path);
  if (!full.startsWith(ROOT + path.sep)) { errors.push(`Path escapes project root: ${entry.path}`); continue; }
  try {
    const b = await fs.readFile(full);
    const h = crypto.createHash('sha256').update(b).digest('hex');
    if (b.length !== entry.size_bytes || h !== entry.sha256) errors.push(`Checksum/size mismatch: ${entry.path}`);
  } catch { errors.push(`Missing file: ${entry.path}`); }
}
if (errors.length) {
  console.error(`Manifest verification FAIL (${errors.length} issue(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Manifest verification PASS: ${manifest.files.length} files, SHA-256 + size matched.`);
}
