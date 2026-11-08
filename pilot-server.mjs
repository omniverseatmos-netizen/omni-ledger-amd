import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PilotStore, emptyPilotState } from './pilot-persistence.mjs';
import { PilotService } from './pilot-service.mjs';
import { OidcProvider } from './oidc.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PILOT_PORT || 4180);
const authMode = process.env.AUTH_MODE || (process.env.OIDC_ISSUER ? 'oidc' : 'local');
const oidc = new OidcProvider();
if (process.env.NODE_ENV === 'production' && authMode !== 'oidc') throw new Error('AUTH_MODE=oidc is required in production; local password authentication is disabled.');
if (process.env.NODE_ENV === 'production' && authMode === 'oidc') oidc.assertEnabled();
const HOST = process.env.PILOT_HOST || '127.0.0.1';
let store;
if (process.env.PERSISTENCE === 'postgres') {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required when PERSISTENCE=postgres.');
  const { PostgresPilotStore } = await import('./pilot-postgres.mjs');
  store = new PostgresPilotStore({ connectionString: process.env.DATABASE_URL, tenantId: process.env.PILOT_TENANT_ID || 'T1', initialState: emptyPilotState(), normalized: process.env.NORMALIZED_REPOSITORY === '1' });
} else {
  store = new PilotStore({ filePath: process.env.ATMOS_PILOT_STATE || path.join(ROOT, '.pilot', 'state.json'), initialState: emptyPilotState() });
}
const service = new PilotService({ store });
const bootstrapToken = process.env.PILOT_BOOTSTRAP_TOKEN;
if (process.env.NODE_ENV === 'production' && (!bootstrapToken || bootstrapToken.length < 32)) throw new Error('PILOT_BOOTSTRAP_TOKEN must be a 32+ character secret in production.');
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' };
const send = (res, status, body) => { res.writeHead(status, headers); res.end(JSON.stringify(body)); };
async function body(req) { let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 1_000_000) throw Object.assign(new Error('Payload too large.'), { status: 413, code: 'PAYLOAD_TOO_LARGE' }); } try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400, code: 'INVALID_JSON' }); } }
const tokenOf = req => (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
const keyOf = req => req.headers['idempotency-key'];
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') return send(res, 200, { ok: true, service: 'atmos-pilot' });
    if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (req.method === 'POST' && url.pathname === '/v1/bootstrap') {
      if (bootstrapToken && req.headers['x-bootstrap-token'] !== bootstrapToken) return send(res, 401, { error: 'BOOTSTRAP_TOKEN_REQUIRED' });
      if (!bootstrapToken && process.env.NODE_ENV !== 'development') return send(res, 503, { error: 'BOOTSTRAP_DISABLED' });
      return send(res, 200, await service.bootstrap({ admin: await body(req) }));
    }
    if (req.method === 'GET' && url.pathname === '/v1/auth/oidc/start') { const target = url.searchParams.get('return_to') || '/'; return res.writeHead(302, { Location: await oidc.authorizationUrl(target) }).end(); }
    if (req.method === 'GET' && url.pathname === '/v1/auth/oidc/callback') { const result = await oidc.exchange(url.searchParams.get('code'), url.searchParams.get('state')); const session = await service.loginExternal({ subject: result.claims.sub, email: result.claims.email || `${result.claims.sub}@oidc.invalid`, displayName: result.claims.name || result.claims.preferred_username || result.claims.email, tenantId: result.tenantId, roles: result.roles }); return send(res, 200, { ...session, returnTo: result.returnTo }); }
    if (req.method === 'POST' && url.pathname === '/v1/auth/login') { if (authMode === 'oidc') return send(res, 403, { error: 'LOCAL_PASSWORD_DISABLED', message: 'Use OIDC/Entra ID sign-in.' }); return send(res, 200, await service.login(await body(req))); }
    const token = tokenOf(req);
    if (req.method === 'GET' && url.pathname === '/v1/me') return send(res, 200, await service.me(token));
    if (req.method === 'GET' && url.pathname === '/v1/dispositions/dashboard') return send(res, 200, await service.dashboard(token));
    if (req.method === 'POST' && url.pathname === '/v1/dispositions') return send(res, 201, await service.createDisposition(token, await body(req), keyOf(req)));
    const approve = url.pathname.match(/^\/v1\/dispositions\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approve) { const input = await body(req); return send(res, 200, await service.approveDisposition(token, approve[1], input.decision || 'APPROVE', input.note || '', keyOf(req))); }
    const execute = url.pathname.match(/^\/v1\/dispositions\/([^/]+)\/execute$/);
    if (req.method === 'POST' && execute) return send(res, 200, await service.executeDisposition(token, execute[1], keyOf(req)));
    return send(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    // DomainError = a deterministic business rule said NO (not a server fault): 409 (404 for *_NOT_FOUND), never 500.
    const status = error.status || (error.name === 'DomainError' ? (/_NOT_FOUND$/.test(error.code || '') ? 404 : 409) : 500);
    if (status >= 500) console.error(`[pilot] ${req.method} ${req.url?.split('?')[0]} -> ${status} ${error.code || error.name}: ${error.message}`);
    const clientError = status >= 500
      ? { error: 'PILOT_ERROR', message: 'Internal server error.' }
      : { error: error.code || 'PILOT_ERROR', message: error.message };
    send(res, status, clientError);
  }
});
server.listen(PORT, HOST, () => console.log(`AtMoS Pilot API: http://${HOST}:${PORT}`));
export { server };
