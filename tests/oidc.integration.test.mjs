import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { OidcProvider } from '../oidc.mjs';

const b64u = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

test('OIDC exchange validates discovery, RSA JWKS signature, nonce, tenant and roles', async t => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key-1', alg: 'RS256', use: 'sig' };
  const clock = () => new Date('2026-10-20T10:00:00.000Z');
  let issuer;
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/.well-known/openid-configuration') return res.end(JSON.stringify({ authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` }));
    if (req.url === '/jwks') return res.end(JSON.stringify({ keys: [jwk] }));
    if (req.url === '/token') {
      const claims = { iss: issuer, aud: 'atmos-client', sub: 'user-123', email: 'user@example.test', name: 'Test User', tenant_id: 'T1', roles: ['recall_operator', 'quality_officer'], nonce: 'nonce-123', exp: Math.floor(clock().getTime() / 1000) + 300 };
      const header = b64u({ alg: 'RS256', typ: 'JWT', kid: jwk.kid });
      const payload = b64u(claims); const input = `${header}.${payload}`;
      const signer = crypto.createSign('RSA-SHA256'); signer.update(input); signer.end();
      return res.end(JSON.stringify({ id_token: `${input}.${signer.sign(privateKey).toString('base64url')}` }));
    }
    res.writeHead(404); res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  issuer = `http://127.0.0.1:${server.address().port}`;
  const provider = new OidcProvider({ issuer, clientId: 'atmos-client', clientSecret: 'test-secret', redirectUri: `${issuer}/callback`, stateSecret: 's'.repeat(32), allowedTenants: 'T1', clock });
  const state = provider.signState(provider.statePayload({ nonce: 'nonce-123', verifier: 'verifier-123', returnTo: '/dashboard' }));
  const result = await provider.exchange('code-1', state);
  assert.equal(result.claims.sub, 'user-123');
  assert.equal(result.tenantId, 'T1');
  assert.deepEqual(result.roles, ['recall_operator', 'quality_officer']);
  assert.equal(result.returnTo, '/dashboard');
});
