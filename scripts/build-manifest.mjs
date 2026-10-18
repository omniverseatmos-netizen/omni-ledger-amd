import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_EXCLUDED = new Set(['RELEASE_MANIFEST.json','INVENTORY.tsv']);
const HASH_EXCLUDED = new Set(['RELEASE_MANIFEST.json','INVENTORY.tsv','VERIFY_LOG.txt']);
async function walk(dir) {
  const found = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (['.git','node_modules','.DS_Store'].includes(e.name)) continue;
    const full = path.join(dir,e.name);
    if (e.isDirectory()) found.push(...await walk(full)); else found.push(full);
  }
  return found;
}
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function typeOf(p) {
  const e = path.extname(p).toLowerCase();
  return ({'.mjs':'JavaScript module','.html':'HTML UI','.css':'Stylesheet','.json':'JSON data/config','.md':'Documentation','.txt':'Text fixture/log','.tsv':'Inventory manifest','.png':'Image asset','.jpg':'Image asset','.svg':'Vector asset','.pptx':'Presentation','.pdf':'PDF presentation','.yml':'CI workflow'})[e] ?? (p.startsWith('.github/') ? 'Workflow/config' : 'Project file');
}
function roleOf(p) {
  if (p.startsWith('public/')) return 'Built static deployment copy';
  if (p.startsWith('assets/')) return 'Brand/visual asset';
  if (p.startsWith('.github/workflows/')) return 'CI and Pages automation';
  if (p.startsWith('tests/')) return 'Judge-edition acceptance test';
  if (p.endsWith('-tests.mjs') || p === 'tests.mjs') return 'Regression test suite';
  if (p.startsWith('scripts/')) return 'Build/release tooling';
  if (p.startsWith('fixtures/')) return 'Fictional demo fixture';
  if (p.startsWith('docs/')) return 'Supporting technical documentation';
  if (p === 'index.html' || p === 'index-en.html' || p === 'app.mjs' || p === 'styles.css') return 'English judge interface';
  if (p === 'domain.mjs') return 'Deterministic WMS domain core';
  if (p === 'amd_omni_pipeline.mjs') return 'AMD-hosted model extraction CLI';
  if (p === 'PITCH_DECK.pptx' || p === 'PITCH_DECK.pdf') return 'Judge pitch deck';
  if (p === 'SUBMISSION_COPY.md') return 'Submission text';
  if (p === 'DEMO_SCRIPT.md') return 'Demo narration';
  if (p === 'README.md') return 'Project guide';
  return 'Supporting project file';
}
const all = (await walk(ROOT)).map(f => ({ full: f, rel: path.relative(ROOT,f).split(path.sep).join('/') })).filter(f => !INVENTORY_EXCLUDED.has(f.rel)).sort((a,b)=>a.rel.localeCompare(b.rel));
const inventoryRecords = [];
const records = [];
for (const item of all) {
  const bytes = await fs.readFile(item.full);
  const st = await fs.stat(item.full);
  const row = { path: item.rel, type: typeOf(item.rel), size_bytes: st.size, sha256: sha(bytes), role: roleOf(item.rel) };
  inventoryRecords.push(row);
  if (!HASH_EXCLUDED.has(item.rel)) records.push(row);
}
const inventory = ['path\ttype\tsize_bytes\tsha256\trole', ...inventoryRecords.map(r => [r.path,r.type,r.size_bytes,r.sha256,r.role].join('\t'))].join('\n') + '\n';
await fs.writeFile(path.join(ROOT,'INVENTORY.tsv'), inventory);
const manifest = {
  name: 'OmNi-Ledger Judge Edition',
  version: '3.0.6',
  created_at: new Date().toISOString(),
  manifest_policy: 'SHA-256 for all project files except RELEASE_MANIFEST.json, INVENTORY.tsv, TEST_LOG.txt, and VERIFY_LOG.txt (the last two are generated verification transcripts).',
  source_of_truth: 'The root source files; public/ is the generated static deployment copy and is included for byte-level review.',
  file_count: records.length,
  automated_check_summary: { source_suites: 8, source_test_count: 168, judge_acceptance_tests: 13, total_test_count: 181, result: 'See TEST_LOG.txt and VERIFY_LOG.txt; live AMD inference is not included in offline checks.' },
  files: records,
};
await fs.writeFile(path.join(ROOT,'RELEASE_MANIFEST.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(`Built SHA-256 manifest for ${records.length} files; wrote INVENTORY.tsv and RELEASE_MANIFEST.json.`);
