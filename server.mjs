import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const HOST = process.env.HOST || '127.0.0.1';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'Cache-Control': 'no-store',
};
const server = http.createServer(async (req, res) => {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  try {
    if (!['GET', 'HEAD'].includes(req.method || '')) { res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' }); res.end('Method not allowed'); return; }
    const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
    let decoded;
    try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end('Bad path'); return; }
    if (decoded.includes('\0') || decoded.includes('\\')) { res.writeHead(400); res.end('Bad path'); return; }
    let relative = decoded === '/' ? '/index.html' : decoded;
    const segments = relative.split('/').filter(Boolean);
    if (segments.some(segment => segment.startsWith('.')) || ['docs', 'scripts', 'tests', 'fixtures'].includes(segments[0])) { res.writeHead(404); res.end('Not found'); return; }
    const publicFile = new Set(['index.html', 'index-en.html', 'app.mjs', 'styles.css', 'domain.mjs', 'demo-scenarios.mjs']);
    const isAsset = segments[0] === 'assets' && segments.length === 2 && /\.(svg|png|jpe?g|webp)$/i.test(segments[1]);
    if (!isAsset && (segments.length !== 1 || !publicFile.has(segments[0]))) { res.writeHead(404); res.end('Not found'); return; }
    let target = path.resolve(ROOT, `.${relative}`);
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    let stat;
    try { stat = await fs.stat(target); } catch { stat = null; }
    if (stat?.isDirectory()) target = path.join(target, 'index.html');
    const file = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': file.length });
    res.end(req.method === 'HEAD' ? undefined : file);
  } catch (error) {
    if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});
server.listen(PORT, HOST, () => console.log(`OmNi-Ledger Judge Edition: http://${HOST}:${PORT}`));
