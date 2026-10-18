import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
const port = await freePort();
const child = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore','pipe','pipe'] });
let childOutput = '';
child.stdout.on('data', d => { childOutput += d.toString(); });
child.stderr.on('data', d => { childOutput += d.toString(); });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i=0; i<60; i++) {
    if (child.exitCode !== null) throw new Error(`server exited early: ${childOutput}`);
    try { const r = await fetch(base, { signal: AbortSignal.timeout(400) }); if (r.status === 200) { ready = true; break; } } catch {}
    await delay(100);
  }
  assert.equal(ready, true, `server did not become ready: ${childOutput}`);
  for (const pathName of ['/', '/index-en.html', '/styles.css', '/app.mjs', '/domain.mjs', '/demo-scenarios.mjs', '/assets/omni-ledger-cover.png', '/assets/omniledger-mark.svg']) {
    const response = await fetch(`${base}${pathName}`);
    assert.equal(response.status, 200, `${pathName} should be served`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${pathName} should not be empty`);
  }
  const page = await fetch(base);
  const body = await page.text();
  assert.match(body, /<html lang="en"/i);
  assert.match(page.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  assert.equal((await fetch(base, { method:'POST', body:'test' })).status, 405);
  assert.equal((await fetch(`${base}/.env.example`)).status, 404);
  const traversal = await fetch(`${base}/%2e%2e%2fetc%2fpasswd`);
  assert.ok([403,404].includes(traversal.status));
  console.log('HTTP smoke PASS: 8 public assets, English entry page, security headers, method guard, dotfile guard, path traversal guard.');
} finally {
  child.kill('SIGTERM');
}
