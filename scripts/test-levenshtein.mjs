import { spawnSync } from 'node:child_process';
const r=spawnSync(process.execPath,['--test','tests/levenshtein.test.mjs'],{stdio:'inherit'}); process.exit(r.status ?? 1);
