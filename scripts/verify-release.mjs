import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const run = (args, { capture = true } = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 180_000, maxBuffer: 12 * 1024 * 1024, env: process.env });

async function walk(dir) {
  const rows = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'coverage'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) rows.push(...await walk(full));
    else rows.push(full);
  }
  return rows;
}

const siteBuild = run([path.join(ROOT, 'scripts/build-site.mjs')]);
if (siteBuild.status !== 0) failures.push(`Static site build failed\n${siteBuild.stderr || siteBuild.stdout}`);

const allFiles = await walk(ROOT);
const modules = allFiles.filter(f => f.endsWith('.mjs'));
let syntaxCount = 0;
for (const file of modules) {
  const check = run(['--check', file]);
  if (check.status !== 0) failures.push(`Syntax check failed: ${path.relative(ROOT, file)}\n${check.stderr || check.stdout}`);
  else syntaxCount++;
}

for (const relative of ['index.html', 'index-en.html', 'app.mjs', 'styles.css', 'domain.mjs', 'demo-scenarios.mjs', 'amd_omni_pipeline.mjs', 'assets/omniledger-mark.svg', 'assets/omni-ledger-cover.png', 'assets/omni-ledger-cover-16x9.jpg', 'RELEASE_MANIFEST.json', 'INVENTORY.tsv', 'fixtures/invoice-valid.txt', 'fixtures/invoice-expired.txt']) {
  try { await fs.access(path.join(ROOT, relative)); }
  catch { failures.push(`Required asset missing: ${relative}`); }
}

const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
const htmlEn = await fs.readFile(path.join(ROOT, 'index-en.html'), 'utf8');
const publicHtml = await fs.readFile(path.join(ROOT, 'public', 'index-en.html'), 'utf8');
const app = await fs.readFile(path.join(ROOT, 'app.mjs'), 'utf8');
const css = await fs.readFile(path.join(ROOT, 'styles.css'), 'utf8');
for (const [label, condition] of [
  ['English language declaration', /<html lang="en"/i.test(html)],
  ['External app module is wired', /src="\.\/app\.mjs"/.test(html)],
  ['Content Security Policy is present on source and built judge pages', [html, htmlEn, publicHtml].every(page => /<meta http-equiv="Content-Security-Policy"/i.test(page))],
  ['No inline API secret variable in HTML', !/AMD_TOKENFACTORY_API_KEY\s*=\s*["'][^"']{10,}["']/.test(html)],
  ['All six judge views exist', ['overview','intake','recall','trace','evidence','architecture'].every(v => app.includes(`${v}:`) || app.includes(`'${v}'`))],
  ['Reduced-motion styling exists', css.includes('prefers-reduced-motion')],
]) if (!condition) failures.push(`HTML/app guard failed: ${label}`);

const tests = run(['-e', `import {execFileSync} from 'node:child_process'; try { execFileSync('npm',['test'],{stdio:'pipe',cwd:${JSON.stringify(ROOT)}}); console.log('TEST_SUITE_PASS'); } catch(e) { process.stderr.write(e.stdout?.toString()||''); process.stderr.write(e.stderr?.toString()||''); process.exit(e.status||1); }`]);
if (tests.status !== 0) failures.push(`npm test failed\n${tests.stderr || tests.stdout}`);

for (const [name, expected] of [['valid', 'ACCEPTED'], ['expired', 'BLOCKED']]) {
  const command = run([path.join(ROOT, 'amd_omni_pipeline.mjs'), '--scenario', name]);
  if (command.status !== 0) { failures.push(`Offline pipeline fixture failed (${name})\n${command.stderr || command.stdout}`); continue; }
  try {
    const result = JSON.parse(command.stdout);
    if (result.decision !== expected || result.inference?.mode !== 'OFFLINE_FIXTURE_NOT_LIVE' || result.assertion !== 'PASS') failures.push(`Offline pipeline fixture has unexpected output (${name})`);
  } catch { failures.push(`Offline pipeline fixture output is not valid JSON (${name})`); }
}


const httpSmoke = run([path.join(ROOT, 'scripts/http-smoke.mjs')]);
if (httpSmoke.status !== 0) failures.push(`HTTP server smoke test failed\n${httpSmoke.stderr || httpSmoke.stdout}`);
const manifestCheck = run([path.join(ROOT, 'scripts/verify-manifest.mjs')]);
if (manifestCheck.status !== 0) failures.push(`Release manifest verification failed\n${manifestCheck.stderr || manifestCheck.stdout}`);

if (failures.length) {
  console.error('RELEASE VERIFICATION FAILED');
  for (const item of failures) console.error(`\n- ${item}`);
  process.exitCode = 1;
} else {
  console.log(`Release verification PASS`);
  console.log(`Syntax-checked ES modules: ${syntaxCount}/${modules.length}`);
  console.log('Static GitHub Pages build: PASS');
  console.log('Static page Content Security Policy: PASS');
  console.log('Required assets and English UI wiring: PASS');
  console.log('Full automated test command: PASS');
  console.log('Offline valid/expired pipeline fixtures: PASS (not live inference)');
  console.log(`HTTP safety smoke: ${httpSmoke.stdout.trim() || 'PASS'}`);
  console.log(`Release manifest: ${manifestCheck.stdout.trim() || 'PASS'}`);
  console.log('Live AMD inference: NOT RUN (requires a private API key and account model availability)');
}
