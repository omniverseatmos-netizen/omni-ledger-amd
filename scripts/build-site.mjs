import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public');
const FILES = ['index.html','index-en.html','app.mjs','styles.css','domain.mjs','demo-scenarios.mjs'];
const ASSETS = ['omniledger-mark.svg','omni-ledger-cover.png','omni-ledger-cover-16x9.jpg'];
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(path.join(OUT,'assets'), { recursive: true });
for (const file of FILES) await fs.copyFile(path.join(ROOT,file), path.join(OUT,file));
for (const file of ASSETS) await fs.copyFile(path.join(ROOT,'assets',file), path.join(OUT,'assets',file));
const required = [...FILES, ...ASSETS.map(x => `assets/${x}`)];
for (const rel of required) {
  const st = await fs.stat(path.join(OUT,rel));
  if (!st.isFile() || st.size === 0) throw new Error(`Site build contains a missing/empty file: ${rel}`);
}
console.log(`Static Pages build PASS: ${required.length} runtime files copied into public/`);
