import crypto from 'node:crypto';

export const PILOT_ROLES = Object.freeze({
  recall_operator: ['recall:create', 'disposition:create', 'evidence:read'],
  quality_officer: ['recall:read', 'disposition:read', 'disposition:approve:quality', 'evidence:read'],
  qa_manager: ['recall:read', 'disposition:read', 'disposition:approve:qa', 'evidence:read'],
  operations_manager: ['recall:read', 'disposition:read', 'disposition:execute', 'evidence:read'],
  auditor: ['recall:read', 'disposition:read', 'evidence:read'],
  pilot_admin: ['*'],
});
const TOKEN_TTL_SECONDS = 8 * 60 * 60;
const PASSWORD_COST = 16384;
const PASSWORD_BLOCK = 32;
const PASSWORD_PARALLELISM = 1;
const text = value => Buffer.from(String(value), 'utf8');
const safeEqual = (a, b) => { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); };
const passwordPepper = () => {
  const value = process.env.ATMOS_PASSWORD_PEPPER;
  if (process.env.NODE_ENV === 'production' && (!value || value.length < 32)) {
    throw new Error('ATMOS_PASSWORD_PEPPER must be a 32+ character secret in production.');
  }
  return value || 'pilot-development-pepper-change-me';
};
const hashPassword = password => crypto.scryptSync(text(password), text(passwordPepper()), PASSWORD_BLOCK, { N: PASSWORD_COST, r: 8, p: PASSWORD_PARALLELISM }).toString('base64url');
const tokenDigest = token => crypto.createHash('sha256').update(token).digest('base64url');

export function passwordHash(password) { if (typeof password !== 'string' || password.length < 12) throw new Error('Password must contain at least 12 characters.'); return hashPassword(password); }
export function verifyPassword(password, encoded) { return typeof password === 'string' && typeof encoded === 'string' && safeEqual(hashPassword(password), encoded); }

export class RbacError extends Error { constructor(code, message, status = 403) { super(message); this.name = 'RbacError'; this.code = code; this.status = status; } }

export class RbacService {
  constructor({ clock = () => new Date(), tokenSecret = process.env.ATMOS_TOKEN_SECRET } = {}) {
    if (process.env.NODE_ENV === 'production' && (!tokenSecret || tokenSecret.length < 32)) {
      throw new Error('ATMOS_TOKEN_SECRET must be a 32+ character secret in production.');
    }
    this.clock = clock; this.tokenSecret = tokenSecret || 'pilot-token-secret-change-me';
  }
  now() { return this.clock().toISOString(); }
  createUser({ id, email, displayName, roles = [], password, tenantId = 'T1', active = true, externalSubject = null }) {
    if (!id || !email || !displayName || (!password && !externalSubject)) throw new RbacError('USER_FIELDS_REQUIRED', 'id, email, displayName and a password or externalSubject are required.', 400);
    if (!roles.length || roles.some(role => !PILOT_ROLES[role])) throw new RbacError('UNKNOWN_ROLE', 'Every user must have at least one supported role.', 400);
    return { id, email: email.trim().toLowerCase(), displayName: displayName.trim(), tenantId, roles: [...new Set(roles)], passwordHash: password ? passwordHash(password) : null, externalSubject, active, createdAt: this.now() };
  }
  login(user, password) {
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) throw new RbacError('INVALID_CREDENTIALS', 'Invalid credentials.', 401);
    return this.issueSession(user);
  }
  issueSession(user) {
    if (!user?.active) throw new RbacError('INVALID_CREDENTIALS', 'Invalid credentials.', 401);
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock().getTime() + TOKEN_TTL_SECONDS * 1000).toISOString();
    return { token, tokenHash: tokenDigest(token), userId: user.id, tenantId: user.tenantId, issuedAt: this.now(), expiresAt };
  }
  authenticate(session, requiredPermission = null, tenantId = null) {
    if (!session) throw new RbacError('AUTH_REQUIRED', 'Authentication is required.', 401);
    if (new Date(session.expiresAt).getTime() <= this.clock().getTime()) throw new RbacError('SESSION_EXPIRED', 'Session has expired.', 401);
    if (tenantId && session.tenantId !== tenantId) throw new RbacError('TENANT_MISMATCH', 'Tenant boundary rejected the request.', 403);
    if (requiredPermission && !this.allows(session.roles, requiredPermission)) throw new RbacError('PERMISSION_DENIED', `Missing permission: ${requiredPermission}.`, 403);
    return session;
  }
  sessionFor({ session, user }) { return { ...session, roles: [...user.roles], displayName: user.displayName }; }
  allows(roles, permission) { return roles.some(role => PILOT_ROLES[role]?.includes('*') || PILOT_ROLES[role]?.includes(permission)); }
}
export { tokenDigest };
