import crypto from 'node:crypto';

const b64u = value => Buffer.from(value).toString('base64url');
const fromB64u = value => Buffer.from(value, 'base64url');
const json = value => JSON.stringify(value);
const parseJwt = token => {
  const [encodedHeader, encodedPayload, encodedSignature] = String(token || '').split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error('Malformed ID token.');
  return { encodedHeader, encodedPayload, encodedSignature, header: JSON.parse(fromB64u(encodedHeader)), claims: JSON.parse(fromB64u(encodedPayload)) };
};
const hmac = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('base64url');
const timingSafe = (a, b) => { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); };

export class OidcError extends Error {
  constructor(code, message, status = 401) { super(message); this.code = code; this.status = status; }
}

export class OidcProvider {
  constructor({ issuer = process.env.OIDC_ISSUER, clientId = process.env.OIDC_CLIENT_ID, clientSecret = process.env.OIDC_CLIENT_SECRET,
    redirectUri = process.env.OIDC_REDIRECT_URI, stateSecret = process.env.OIDC_STATE_SECRET || process.env.ATMOS_TOKEN_SECRET,
    roleClaim = process.env.OIDC_ROLE_CLAIM || 'roles', tenantClaim = process.env.OIDC_TENANT_CLAIM || 'tenant_id',
    allowedTenants = process.env.OIDC_ALLOWED_TENANTS, clock = () => new Date() } = {}) {
    this.issuer = issuer?.replace(/\/$/, ''); this.clientId = clientId; this.clientSecret = clientSecret; this.redirectUri = redirectUri;
    this.stateSecret = stateSecret; this.roleClaim = roleClaim; this.tenantClaim = tenantClaim;
    this.allowedTenants = allowedTenants ? new Set(allowedTenants.split(',').map(x => x.trim()).filter(Boolean)) : null;
    this.clock = clock; this.discovery = null; this.discoveryAt = 0; this.jwks = null; this.jwksAt = 0;
  }
  get enabled() { return Boolean(this.issuer && this.clientId && this.clientSecret && this.redirectUri && this.stateSecret); }
  assertEnabled() { if (!this.enabled) throw new OidcError('OIDC_NOT_CONFIGURED', 'OIDC is not configured.', 503); }
  async metadata() {
    this.assertEnabled();
    if (!this.discovery || Date.now() - this.discoveryAt > 300_000) {
      const response = await fetch(`${this.issuer}/.well-known/openid-configuration`);
      if (!response.ok) throw new OidcError('OIDC_DISCOVERY_FAILED', 'OIDC discovery failed.', 503);
      this.discovery = await response.json(); this.discoveryAt = Date.now();
    }
    return this.discovery;
  }
  statePayload({ nonce, verifier, returnTo = '/' }) { return { nonce, verifier, returnTo, exp: Math.floor(this.clock().getTime() / 1000) + 600 }; }
  signState(payload) { const raw = b64u(json(payload)); return `${raw}.${hmac(this.stateSecret, raw)}`; }
  readState(value) {
    this.assertEnabled(); const [raw, signature] = String(value || '').split('.');
    if (!raw || !signature || !timingSafe(signature, hmac(this.stateSecret, raw))) throw new OidcError('OIDC_STATE_INVALID', 'Invalid OIDC state.');
    const payload = JSON.parse(fromB64u(raw)); if (!payload.exp || payload.exp < Math.floor(this.clock().getTime() / 1000)) throw new OidcError('OIDC_STATE_EXPIRED', 'Expired OIDC state.');
    return payload;
  }
  async authorizationUrl(returnTo = '/') {
    const metadata = await this.metadata();
    const nonce = b64u(crypto.randomBytes(24)); const verifier = b64u(crypto.randomBytes(32));
    const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
    const state = this.signState(this.statePayload({ nonce, verifier, returnTo }));
    const url = new URL(metadata.authorization_endpoint);
    for (const [key, value] of Object.entries({ client_id: this.clientId, response_type: 'code', redirect_uri: this.redirectUri, scope: 'openid profile email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256' })) url.searchParams.set(key, value);
    return url.toString();
  }
  async exchange(code, state) {
    const statePayload = this.readState(state); const metadata = await this.metadata();
    const response = await fetch(metadata.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri, client_id: this.clientId, client_secret: this.clientSecret, code_verifier: statePayload.verifier }) });
    if (!response.ok) throw new OidcError('OIDC_TOKEN_EXCHANGE_FAILED', 'OIDC token exchange failed.', 401);
    const tokenSet = await response.json(); if (!tokenSet.id_token) throw new OidcError('OIDC_ID_TOKEN_MISSING', 'OIDC provider did not return an ID token.', 401);
    const claims = await this.verifyIdToken(tokenSet.id_token, statePayload.nonce, metadata);
    const roles = this.claimArray(claims[this.roleClaim]);
    const tenantId = String(claims[this.tenantClaim] || claims.tid || '').trim();
    if (!tenantId || (this.allowedTenants && !this.allowedTenants.has(tenantId))) throw new OidcError('OIDC_TENANT_DENIED', 'OIDC tenant is not allowed.', 403);
    return { claims, tenantId, roles, returnTo: statePayload.returnTo };
  }
  claimArray(value) { if (Array.isArray(value)) return value.map(String); if (typeof value === 'string') return value.split(/[ ,]/).map(x => x.trim()).filter(Boolean); return []; }
  async verifyIdToken(token, nonce, metadata) {
    const parsed = parseJwt(token); const claims = parsed.claims;
    if (parsed.header.alg !== 'RS256' && parsed.header.alg !== 'ES256') throw new OidcError('OIDC_ALG_REJECTED', 'Unsupported ID token algorithm.');
    if (claims.iss !== this.issuer || !(claims.aud === this.clientId || (Array.isArray(claims.aud) && claims.aud.includes(this.clientId))) || claims.nonce !== nonce || !claims.sub || !claims.exp || claims.exp <= Math.floor(this.clock().getTime() / 1000)) throw new OidcError('OIDC_CLAIMS_INVALID', 'OIDC ID token claims are invalid.');
    const keys = await this.keys(metadata.jwks_uri); const jwk = keys.find(key => key.kid === parsed.header.kid && key.alg === parsed.header.alg);
    if (!jwk) throw new OidcError('OIDC_KEY_NOT_FOUND', 'OIDC signing key was not found.');
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const verifier = crypto.createVerify(parsed.header.alg === 'RS256' ? 'RSA-SHA256' : 'SHA256'); verifier.update(`${parsed.encodedHeader}.${parsed.encodedPayload}`); verifier.end();
    if (!verifier.verify(publicKey, fromB64u(parsed.encodedSignature))) throw new OidcError('OIDC_SIGNATURE_INVALID', 'OIDC ID token signature is invalid.');
    return claims;
  }
  async keys(url) { if (!this.jwks || Date.now() - this.jwksAt > 300_000) { const response = await fetch(url); if (!response.ok) throw new OidcError('OIDC_JWKS_FAILED', 'OIDC signing keys could not be loaded.', 503); this.jwks = (await response.json()).keys || []; this.jwksAt = Date.now(); } return this.jwks; }
}
