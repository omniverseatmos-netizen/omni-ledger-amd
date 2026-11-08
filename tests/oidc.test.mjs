import test from 'node:test';
import assert from 'node:assert/strict';
import { OidcProvider, OidcError } from '../oidc.mjs';

test('OIDC state is signed, expires, and rejects tampering', async () => {
  const clock = () => new Date('2026-10-20T10:00:00.000Z');
  const provider = new OidcProvider({ issuer: 'https://login.microsoftonline.com/example/v2.0', clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.test/callback', stateSecret: 'a'.repeat(32), clock });
  const state = provider.signState(provider.statePayload({ nonce: 'n', verifier: 'v' }));
  assert.deepEqual(provider.readState(state).nonce, 'n');
  assert.throws(() => provider.readState(`${state}x`), error => error.code === 'OIDC_STATE_INVALID');
});

test('OIDC requires complete production configuration', () => {
  const provider = new OidcProvider({ issuer: 'https://issuer.test', clientId: 'client' });
  assert.equal(provider.enabled, false);
  assert.throws(() => provider.assertEnabled(), error => error instanceof OidcError && error.code === 'OIDC_NOT_CONFIGURED');
});

test('OIDC role and tenant claims are parsed without trusting unsupported roles', () => {
  const provider = new OidcProvider({ roleClaim: 'roles', tenantClaim: 'tenant_id', allowedTenants: 'T1,T2' });
  assert.deepEqual(provider.claimArray(['recall_operator', 'quality_officer']), ['recall_operator', 'quality_officer']);
  assert.deepEqual(provider.claimArray('auditor, qa_manager'), ['auditor', 'qa_manager']);
  assert.equal(provider.allowedTenants.has('T1'), true);
});
